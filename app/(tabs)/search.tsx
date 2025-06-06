import React, { useState, useRef, useEffect } from 'react';
import {  Alert, StyleSheet, View, TextInput, TouchableOpacity, Image, Dimensions, FlatList, Text, Animated, Platform, KeyboardAvoidingView, ScrollView, BackHandler, Keyboard, Share, Linking } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Picker } from '@react-native-picker/picker';
import { useFavorites } from '@/context/FavoritesContext';
import { useGrocery } from '@/context/GroceryContext';


type Recipe = {
  id: number;
  title: string;
  image: string;
  readyInMinutes?: number;
  instructions: string;
  extendedIngredients: { original: string }[];
};

const { width, height } = Dimensions.get('window');

export default function SearchScreen({ navigation }: { navigation: any }) {
  const [offset, setOffset] = useState(0); 
  const [hasMore, setHasMore] = useState(true);
  const [ingredients, setIngredients] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]); 
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [dietFilter, setDietFilter] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [maxCookingTime, setMaxCookingTime] = useState('');
  const [excludedIngredients, setExcludedIngredients] = useState('');
  const { addFavorite, removeFavorite, isFavorited, isLoggedIn } = useFavorites();
  const { addGroceryItem, removeGroceryItemByName, groceryItems } = useGrocery();
  const [isExploreMode, setIsExploreMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Create video player for loading animation
  const videoPlayer = useVideoPlayer(require('@/assets/animations/buns.mp4'), player => {
    player.loop = true;
    if (loading) {
      player.play();
    } else {
      player.pause();
    }
  });

  // Update video playback based on loading state
  useEffect(() => {
    if (loading) {
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
  }, [loading, videoPlayer]);

  // Handle back button press for Android
  useEffect(() => {
    const backAction = () => {
      if (selectedRecipe) {
        closeRecipe();
        return true; // Prevent default back action
      }
      
      if (isFilterVisible) {
        setIsFilterVisible(false);
        return true; // Prevent default back action
      }
      
      return false; // Allow default back action
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, [selectedRecipe, isFilterVisible]);

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

  const handleFavoriteToggle = () => {
    if (!selectedRecipe) return;
    
    if (!isLoggedIn) {
      Alert.alert(
        "Login Required", 
        "Please login to save favorites that will persist across devices. You can continue without logging in, but your favorites will only be stored on this device.",
        [
          { 
            text: "Continue without login",
            onPress: () => saveRecipeToFavorites()
          },
          {
            text: "Go to Login",
            onPress: () => {
              closeRecipe();
              navigation.navigate('Login');
            }
          }
        ]
      );
      return;
    }
    
    saveRecipeToFavorites();
  };
  
  const saveRecipeToFavorites = () => {
    if (!selectedRecipe) return;
    
    if (isFavorited(selectedRecipe.id)) {
      removeFavorite(selectedRecipe.id);
    } else {
      addFavorite({
        id: selectedRecipe.id,
        name: selectedRecipe.title,
        details: selectedRecipe.instructions || '',
        image: selectedRecipe.image,
      });
    }
  };

  const handleToggleGroceryItem = (ingredientName: string) => {
    const isInGrocery = isIngredientInGrocery(ingredientName);
    
    if (isInGrocery) {
      removeGroceryItemByName(ingredientName);
    } else {
      addGroceryItem(ingredientName);
    }
  };

  const isIngredientInGrocery = (ingredientName: string) => {
    return groceryItems.some(item => 
      item.name.toLowerCase().trim() === ingredientName.toLowerCase().trim() && !item.checked
    );
  };
  
  const fetchRecipes = async (append = false) => {
    if (!ingredients.trim()) {
      Alert.alert('No Ingredients Added', 'Please enter at least one ingredient to search.');
      return;
    }
    
    Keyboard.dismiss();
    
    setLoading(true);
    setNoResults(false);
    setIsExploreMode(false);
    
    try {
      const nextOffset = append ? offset + 10 : 0;

      const queryParams = new URLSearchParams({
        includeIngredients: ingredients,
        number: '10',
        offset: nextOffset.toString(),
        apiKey: '1f0d82fedefb4978912be65634536f13',
      });
  
      if (dietFilter) {
        queryParams.append('diet', dietFilter);
      }

      if (excludedIngredients.trim()) {
        const cleaned = excludedIngredients
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .join(',');
        queryParams.append('excludeIngredients', cleaned);
      }

      if (maxCookingTime) {
        queryParams.append('maxReadyTime', maxCookingTime);
      }
  
      const response = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?${queryParams.toString()}&addRecipeInformation=true`
      );
  
      const data = await response.json();
  
      const results = data.results || [];
  
      if (append) {
        setRecipes((prev) => [...prev, ...results]);
      } else {
        setRecipes(results);
        setHasSearched(true);
        
        if (results.length === 0) {
          setNoResults(true);
        }
      }
  
      setOffset(nextOffset);
      setHasMore(results.length === 10);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
      Alert.alert('Error', 'Failed to fetch recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExplore = async () => {
    setDietFilter('');
    setLoading(true);
    setNoResults(false);
    setIsExploreMode(true);
    
    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/random?number=10&apiKey=1f0d82fedefb4978912be65634536f13`
      );
      const data = await response.json();
      
      setTimeout(() => {
        const results = data.recipes || [];
        setRecipes(results);
        setHasSearched(true);
        
        if (results.length === 0) {
          setNoResults(true);
        }
        
        setLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Error fetching random recipes:', error);
      Alert.alert('Error', 'Failed to fetch random recipes. Please try again.');
      setLoading(false);
    }
  };

  const openRecipe = async (recipe: Recipe) => {
    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=1f0d82fedefb4978912be65634536f13`
      );
      const data = await response.json();
      setSelectedRecipe(data);
    } catch (error) {
      console.error('Failed to fetch recipe details:', error);
      Alert.alert('Error', 'Failed to load recipe details. Please try again.');
    }
  };

  const closeRecipe = () => {
    setSelectedRecipe(null);
  };

  const renderWelcomeMessage = () => (
    <View style={styles.welcomeContainer}>
      <MaterialIcons name="restaurant-menu" size={80} color="#3E1F15" />
      <Text style={styles.welcomeTitle}>Welcome to Recipe Rabbit!</Text>
      <Text style={styles.welcomeText}>
        Enter ingredients in the search bar above to find delicious recipes.
      </Text>
      <Text style={styles.welcomeHint}>
        💡 Tip: Use commas to separate multiple ingredients
      </Text>
      <Text style={styles.welcomeExample}>
        Example: "chicken, rice, vegetables"
      </Text>
      <Text style={styles.welcomeOrText}>
        Or try the "Random Recipes" button for inspiration!
      </Text>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.noResultsContainer}>
      <MaterialIcons name="search-off" size={80} color="#A9A9A9" />
      <Text style={styles.noResultsTitle}>No Recipes Found</Text>
      <Text style={styles.noResultsText}>
        We couldn't find any recipes matching your search criteria. Try:
      </Text>
      <Text style={styles.noResultsTip}>• Using different ingredients</Text>
      <Text style={styles.noResultsTip}>• Removing some filters</Text>
      <Text style={styles.noResultsTip}>• Checking your spelling</Text>
    </View>
  );

  return (

      <ThemedView style={styles.container}>
        {/* Top Logo */}
        <Image source={require('../../assets/images/recipeRabbitLogo.png')} style={styles.logo} />

        {/* Search Input with Filter Button */}
        <View style={styles.searchWrapper}>
          <View style={styles.filterButtonContainer}>
            <TouchableOpacity 
              style={styles.filterButton} 
              onPress={() => setIsFilterVisible(!isFilterVisible)}
            >
              <Feather name="sliders" size={22} color="black" />
            </TouchableOpacity>
            <Text style={styles.optionsText}>Filter</Text>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search ingredients..."
            placeholderTextColor="#A9A9A9"
            value={ingredients}
            onChangeText={setIngredients}
          />

          <TouchableOpacity style={styles.searchButton} onPress={() => fetchRecipes(false)}>
            <AntDesign name="search1" size={20} color="black" />
          </TouchableOpacity>
        </View>

        {/* Explore Button */}
        <TouchableOpacity style={styles.exploreButton} onPress={handleExplore}>
          <Text style={styles.applyText}>Random Recipes</Text>
        </TouchableOpacity>

        {/* Content Area - Fixed position to prevent keyboard interference */}
        <View style={styles.contentArea}>
          {/* Welcome Message - Show when no search has been performed */}
          {!hasSearched && !loading && renderWelcomeMessage()}

          {/* Loading Animation*/}
          {loading && (
            <View style={styles.loadingContainer}>
              <VideoView
                style={{ width: 200, height: 200 }}
                player={videoPlayer}
                allowsFullscreen={false}
                allowsPictureInPicture={false}
                nativeControls={false}
                contentFit="contain"
                pointerEvents="none"
              />
              <Text style={styles.loadingText}>Finding delicious recipes...</Text>
            </View>
          )}
          {/* No Results Message */}
          {!loading && noResults && hasSearched && renderNoResults()}

          {/* Recipe List */}
          {!loading && !noResults && recipes.length > 0 && (
            <FlatList
              data={recipes}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }: { item: Recipe }) => (
                <TouchableOpacity style={styles.recipeItem} onPress={() => openRecipe(item)}>
                  <Image source={{ uri: item.image }} style={styles.recipeImage} />
                  <View style={styles.recipeTextContainer}>
                    <ThemedText type="defaultSemiBold" style={styles.recipeName}>
                      {item.title}
                    </ThemedText>
                  </View>
                  <AntDesign name="right" style={{ right: 10 }} size={24} color="white" />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Load More Button - Only show in search mode, not explore mode */}
          {hasMore && !selectedRecipe && hasSearched && !loading && !noResults && !isExploreMode && (
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => fetchRecipes(true)}>
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Full-Screen Recipe View */}
        {selectedRecipe && (
          <View style={styles.collapsible}>
            <View style={styles.imageBackground}>
              <Animated.Image source={{ uri: selectedRecipe.image }} style={styles.fullImage}/>
            </View>

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
            <TouchableOpacity style={styles.shareButton} onPress={handleShareRecipe}>
              <MaterialIcons name="share" size={24} color="white" />
            </TouchableOpacity>

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
                {cleanInstructions(selectedRecipe.instructions)}
              </Text>
            </Animated.ScrollView>
          </View>
        )}
        
        {/* Collapsible Filter Section at Bottom */}
        {isFilterVisible && (
          <View style={styles.filterContainer}>
            <ThemedText type="subtitle">Allergies/Exclusions</ThemedText>
            <TextInput 
              style={styles.filterInput} 
              placeholder="E.g., eggs, peanuts, shellfish..."
              value={excludedIngredients}
              onChangeText={setExcludedIngredients}
            />

            <ThemedText type="subtitle">Dietary Preference</ThemedText>
            <View style={styles.pickerWrapper} >
              <Picker
                selectedValue={dietFilter}
                onValueChange={(itemValue) => setDietFilter(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select a dietary preference..." value="" style={styles.pickerItem} />
                <Picker.Item label="Vegetarian" value="vegetarian" style={styles.pickerItem} />
                <Picker.Item label="Vegan" value="vegan" style={styles.pickerItem} />
                <Picker.Item label="Gluten Free" value="gluten free" style={styles.pickerItem} />
                <Picker.Item label="Ketogenic" value="ketogenic" style={styles.pickerItem} />
                <Picker.Item label="Pescetarian" value="pescetarian" style={styles.pickerItem} />
                <Picker.Item label="Paleo" value="paleo" style={styles.pickerItem} />
                <Picker.Item label="Lacto-Vegetarian" value="lacto-vegetarian" style={styles.pickerItem} />
                <Picker.Item label="Ovo-Vegetarian" value="ovo-vegetarian" style={styles.pickerItem} />
                <Picker.Item label="Whole30" value="whole30" style={styles.pickerItem} />
              </Picker>
            </View>

            <ThemedText type="subtitle">Max Cooking Time (minutes):</ThemedText>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={maxCookingTime}
                onValueChange={(itemValue) => setMaxCookingTime(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Any" value="" style={styles.pickerItem} />
                <Picker.Item label="15 minutes or less" value="15" style={styles.pickerItem} />
                <Picker.Item label="30 minutes or less" value="30" style={styles.pickerItem} />
                <Picker.Item label="45 minutes or less" value="45" style={styles.pickerItem} />
                <Picker.Item label="1 hour or less" value="60" style={styles.pickerItem} />
              </Picker>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setIsFilterVisible(false)}>
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.applyButton} onPress={() => {setIsFilterVisible(false); fetchRecipes(false);}}>
                <ThemedText style={styles.applyText}>Apply</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCE0',
    alignItems: 'center',
    paddingVertical: 20,
  },
  logo: {
    width: 80,
    height: 80,
    marginVertical: 10,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 30,
    backgroundColor: 'white',
    width: 330,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: 50,
    paddingLeft: 10,
  },
  searchButton: {
    backgroundColor: '#D9D9D9',
    padding: 10,
    borderRadius: 20,
  },
  exploreButton: {
    backgroundColor: '#3E1F15',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'black',
    width: 200,
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20,
  },
  contentArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  /* --- Welcome Message Section --- */
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E1F15',
    marginTop: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
  },
  welcomeHint: {
    fontSize: 16,
    color: '#3E1F15',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  welcomeExample: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 25,
  },
  welcomeOrText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  /* --- Loading Animation Section --- */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFCE0',
    width: '100%',
  },
  loadingText: {
    fontSize: 18,
    color: '#3E1F15',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
  },
  /* --- No Results Section --- */
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noResultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3E1F15',
    marginTop: 20,
    marginBottom: 10,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  noResultsTip: {
    fontSize: 14,
    color: '#888',
    marginVertical: 2,
  },
  /* --- End of No Results Section --- */
  /* --- Start of Filter Collapsible Section --- */
  filterButtonContainer: {
    alignItems: 'center',
    marginRight: 10,
  },
  filterButton: {
    marginBottom: -3,
  },
  optionsText: {
    fontSize: 12,
    color: 'black',
    fontWeight: '500',
  },
  pickerWrapper: {
    width: '90%',
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 30,
    backgroundColor: 'white',
    marginVertical: 20,
    overflow: 'hidden',
    fontSize: 13,
  },
  picker: {
    width: '100%',
    height: 50,
  },
  pickerItem: {
    fontSize: 13,
  },
  filterContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFCE0',
    padding: 15,
    borderColor: 'black',
    borderWidth: 1,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    alignItems: 'center',
  },
  filterInput: {
    width: '90%',
    borderWidth: 1,
    borderColor: 'black',
    borderRadius: 30,
    backgroundColor: 'white',
    height: 50,
    marginVertical: 30,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'black',
    width:140,
    flexDirection: 'column',
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: '#3E1F15',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    width:140,
    flexDirection: 'column',
    alignItems: 'center',
  },
  applyText: {
    color: 'white',
    fontWeight: 'bold',
  },
  /* --- End of Filter Collapsible Section --- */
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
  collapsible: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageBackground: {
    width: width,
    height: height * 0.4,
    backgroundColor: '#3E1F15',
    position: 'absolute',
    top: 0,
  },
  fullImage: {
    width: width,
    height: height * 0.4,
    resizeMode: 'cover',
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
  sectionTitle: {
    fontSize: 20,
    color: 'white',
    marginTop: 10,
  },
  instructions: {
    fontSize: 16,
    color: 'white',
    marginTop: 10,
    marginBottom: 40,
  },
  loadMoreButton: {
    backgroundColor: '#3E1F15',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginVertical: 20,
  },
  loadMoreText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
});