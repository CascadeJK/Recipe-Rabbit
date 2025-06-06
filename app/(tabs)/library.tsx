import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Text, Image, Dimensions, View, ActivityIndicator, BackHandler, Alert, Share, Linking } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useFavorites } from '@/context/FavoritesContext';
import { useGrocery } from '@/context/GroceryContext';
import type { Recipe } from '@/context/FavoritesContext';
import AntDesign from '@expo/vector-icons/AntDesign';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Animated } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function FavoritesScreen() {
  const { favorites, toggleFavorite, isFavorited, loading } = useFavorites();
  const { addGroceryItem, removeGroceryItemByName, groceryItems } = useGrocery();
  
  type FullRecipe = {
    id: number;
    title: string;
    image: string;
    instructions?: string;
    readyInMinutes?: number;
    extendedIngredients?: { original: string }[];
  };
  
  const [selectedRecipe, setSelectedRecipe] = useState<FullRecipe | null>(null);
  const [fetchingRecipe, setFetchingRecipe] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  // Handle back button press for Android
  useEffect(() => {
    const backAction = () => {
      if (selectedRecipe) {
        closeRecipe();
        return true; // Prevent default back action
      }
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [selectedRecipe]);

  // Function to clean HTML tags from instructions
  const cleanInstructions = (htmlString: string) => {
    if (!htmlString) return 'No instructions provided.';
    
    return htmlString
      .replace(/<\/?[^>]+(>|$)/g, '') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')        // Replace &nbsp; with space
      .replace(/&amp;/g, '&')        // Replace &amp; with &
      .replace(/&lt;/g, '<')         // Replace &lt; with <
      .replace(/&gt;/g, '>')         // Replace &gt; with >
      .replace(/&quot;/g, '"')       // Replace &quot; with "
      .replace(/&#39;/g, "'")        // Replace &#39; with '
      .trim();
  };

  const handleToggleGroceryItem = (ingredientName: string) => {
    const isInGrocery = isIngredientInGrocery(ingredientName);
    
    if (isInGrocery) {
      // Remove from grocery list
      removeGroceryItemByName(ingredientName);
    } else {
      // Add to grocery list
      addGroceryItem(ingredientName);
    }
  };

  const isIngredientInGrocery = (ingredientName: string) => {
    return groceryItems.some(item => 
      item.name.toLowerCase().trim() === ingredientName.toLowerCase().trim() && !item.checked
    );
  };

  const handleShareRecipe = async () => {
  if (!selectedRecipe) return;

  try {
    const ingredientsList = selectedRecipe.extendedIngredients
      ? selectedRecipe.extendedIngredients.map(ingredient => `• ${ingredient.original}`).join('\n')
      : 'No ingredients available';

    const recipeText = `
🍽️ ${selectedRecipe.title}

📸 Recipe Image: ${selectedRecipe.image}

⏰ Cooking Time: ${selectedRecipe.readyInMinutes ? `${selectedRecipe.readyInMinutes} minutes` : 'Not specified'}

📝 INGREDIENTS:
${ingredientsList}

👨‍🍳 INSTRUCTIONS:
${cleanInstructions(selectedRecipe.instructions || '')}

📱 Shared from Recipe Rabbit App
    `.trim();

    const shareOptions = {
      message: recipeText,
      title: `Recipe: ${selectedRecipe.title}`,
      url: selectedRecipe.image,
    };

    await Share.share(shareOptions);

  } catch (error) {
    console.error('Share error:', error);
    Alert.alert(
      'Share Error',
      'Unable to share the recipe. Please try again.',
      [{ text: 'OK' }]
    );
  }
};

  const renderItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity onPress={() => openRecipe(item.id)} style={styles.recipeItem}>
      <Image source={{ uri: item.image }} style={styles.recipeImage} />
      <View style={styles.recipeTextContainer}>
        <Text style={styles.recipeName}>{item.name}</Text>
      </View>
      
      <AntDesign name="right" style={{ right: 10 }} size={24} color="white" />
    </TouchableOpacity>
  );
  
  const openRecipe = async (recipeId: number) => {
    try {
      setFetchingRecipe(true);
      const response = await fetch(`https://api.spoonacular.com/recipes/${recipeId}/information?apiKey=1f0d82fedefb4978912be65634536f13`);
      const data = await response.json();
      setSelectedRecipe(data);
    } catch (error) {
      console.error('Failed to fetch recipe details:', error);
    } finally {
      setFetchingRecipe(false);
    }
  };
  
  const closeRecipe = () => {
    setSelectedRecipe(null);
  };

  const handleFavoriteToggle = () => {
    if (selectedRecipe) {
      const basicRecipe: Recipe = {
        id: selectedRecipe.id,
        name: selectedRecipe.title,
        image: selectedRecipe.image,
        details: selectedRecipe.instructions || 'No details provided.',
      };
      toggleFavorite(basicRecipe);
    }
  };
  
  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3E1F15" />
        <Text style={styles.loadingText}>Loading your favorites...</Text>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <AntDesign name="heart" size={60} color="#B00401" style={styles.icon} />
      <ThemedText style={styles.title}>Your Favorites</ThemedText>

      {favorites.length === 0 ? (
        <Text style={styles.emptyText}>No favorite recipes yet. Start adding some!</Text>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
        />
      )}

      {/* Full-Screen Recipe View */}
      {selectedRecipe && (
        <View style={styles.collapsible}>
          {/* Brown background behind image */}
          <View style={styles.imageBackground} />
          
          <Animated.Image source={{ uri: selectedRecipe.image }} style={styles.fullImage}/>

          <TouchableOpacity style={styles.closeButton} onPress={closeRecipe}>
            <AntDesign name="arrowleft" size={24} color="white" />
          </TouchableOpacity>

          {/* Heart Button */}
          <TouchableOpacity style={styles.favoriteButton} onPress={handleFavoriteToggle}>
            <AntDesign 
              name={isFavorited(selectedRecipe.id) ? "heart" : "hearto"} 
              size={24} 
              color={isFavorited(selectedRecipe.id) ? "red" : "white"}
            />
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareButton} onPress={handleShareRecipe }>
            <MaterialIcons name="share" size={24} color="white" />
          </TouchableOpacity>

          {fetchingRecipe ? (
            <View style={styles.loadingRecipeContainer}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingRecipeText}>Loading recipe details...</Text>
            </View>
          ) : (
            <Animated.ScrollView
              style={styles.recipeContent}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={16}
            >
              <Text style={styles.recipeTitle}>{selectedRecipe.title}</Text>

              {/* Cooking Time */}
              <Text style={styles.sectionTitle}>Cooking Time: </Text>
              {selectedRecipe.readyInMinutes !== undefined && (
                <Text style={styles.recipeDetails}> {selectedRecipe.readyInMinutes} minutes</Text>
              )}
                
              {/* Ingredients with Checkboxes */}
              {selectedRecipe.extendedIngredients && (
                <>
                  <Text style={styles.sectionTitle}>Ingredients:</Text>
                  {selectedRecipe.extendedIngredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientRow}>
                      <TouchableOpacity 
                        style={styles.checkboxContainer}
                        onPress={() => handleToggleGroceryItem(ingredient.original)}
                      >
                        <MaterialIcons 
                          name={isIngredientInGrocery(ingredient.original) ? "check-box" : "check-box-outline-blank"} 
                          size={20} 
                          color={isIngredientInGrocery(ingredient.original) ? "#4CAF50" : "white"}
                        />
                      </TouchableOpacity>
                      <Text style={styles.ingredientText}>• {ingredient.original}</Text>
                    </View>
                  ))}
                  <Text style={styles.checkboxHint}>Tap the checkbox to add/remove ingredients from your grocery list</Text>
                </>
              )}
              {/* Instructions */}
              <Text style={styles.sectionTitle}>Instructions:</Text>
              <Text style={styles.instructions}>
                {cleanInstructions(selectedRecipe.instructions || '')}
              </Text>
            </Animated.ScrollView>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCE0',
    paddingTop: 60,
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#3E1F15',
  },
  loadingRecipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.35,
    backgroundColor: '#3E1F15',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  loadingRecipeText: {
    marginTop: 10,
    fontSize: 16,
    color: 'white',
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    marginBottom: 20,
    fontSize: 28,
    fontWeight: 'bold',
    paddingTop: 5,
    marginTop: 10,
    color: '#3E1F15',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 280,
    backgroundColor: '#3E1F15',
    borderRadius: 10,
    marginVertical: 10,
    padding: 5,
  },
  recipeImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    marginRight: 10,
  },
  recipeTextContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  recipeName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  heartIcon: {
    padding: 6,
  },
  emptyText: {
    marginTop: 40,
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  collapsible: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    backgroundColor: '#3E1F15',
  },
  fullImage: {
    width: width,
    height: height * 0.4,
    resizeMode: 'cover',
    position: 'absolute',
    top: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 20,
  },
  favoriteButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 5,
    borderRadius: 20,
  },
 shareButton: {
  position: 'absolute',
  top: 40,
  right: 70, // Position it to the left of the heart button
  backgroundColor: 'rgba(0,0,0,0.5)',
  padding: 5,
  borderRadius: 20,
},
  recipeContent: {
    marginTop: height * 0.35,
    backgroundColor: '#3E1F15',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    color: 'white',
    marginTop: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    paddingHorizontal: 5,
  },
  checkboxContainer: {
    marginRight: 10,
    padding: 5,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: 'white',
    lineHeight: 22,
  },
  checkboxHint: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  recipeDetails: {
    fontSize: 16,
    color: 'white',
    marginTop: 10,
  },
  instructions: {
    fontSize: 16,
    color: 'white',
    marginTop: 10,
    marginBottom: 40,
  },
});