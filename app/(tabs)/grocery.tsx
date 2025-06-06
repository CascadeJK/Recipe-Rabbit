import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,ActivityIndicator } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useGrocery } from '@/context/GroceryContext';

export default function GroceryScreen() {
  const { 
    groceryItems, 
    addGroceryItem, 
    removeGroceryItem, 
    toggleGroceryItem, 
    clearCheckedItems, 
    clearAllItems, 
    loading,
    isLoggedIn 
  } = useGrocery();
  
  const [newIngredient, setNewIngredient] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      addGroceryItem(newIngredient.trim());
      setNewIngredient('');
      setShowAddInput(false);
    }
  };

  // Debug version of handleClearChecked
  const handleClearChecked = () => {
    const checkedItems = groceryItems.filter(item => item.checked);
    console.log('Checked items to clear:', checkedItems.length);
    console.log('Checked items:', checkedItems);
    
    if (checkedItems.length > 0) {
      Alert.alert(
        'Clear Checked Items',
        `Are you sure you want to remove ${checkedItems.length} checked item${checkedItems.length > 1 ? 's' : ''}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Clear', 
            onPress: () => {
              console.log('User confirmed clear checked items');
              clearCheckedItems();
            }, 
            style: 'destructive' 
          }
        ]
      );
    } else {
      console.log('No checked items to clear');
    }
  };

  const handleClearAll = () => {
    if (groceryItems.length > 0) {
      Alert.alert(
        'Clear All Items',
        'Are you sure you want to remove all items from your grocery list?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear All', onPress: clearAllItems, style: 'destructive' }
        ]
      );
    }
  };

  const renderGroceryItem = ({ item }: { item: any }) => (
    <View style={styles.groceryItem}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => toggleGroceryItem(item.id)}
      >
        <MaterialIcons
          name={item.checked ? "check-box" : "check-box-outline-blank"}
          size={24}
          color={item.checked ? "#4CAF50" : "#3E1F15"}
        />
      </TouchableOpacity>
      
      <Text style={[
        styles.ingredientText,
        item.checked && styles.checkedText
      ]}>
        {item.name}
      </Text>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeGroceryItem(item.id)}
      >
        <MaterialIcons name="delete" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  // Calculate stats
  const checkedCount = groceryItems.filter(item => item.checked).length;
  const uncheckedCount = groceryItems.filter(item => !item.checked).length;

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <MaterialIcons name="local-grocery-store" size={80} color="black" />
        <ThemedText style={styles.title}>Grocery List</ThemedText>
        <ActivityIndicator size="large" color="#3E1F15" style={styles.loading} />
        <Text style={styles.loadingText}>Loading your grocery list...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <MaterialIcons name="local-grocery-store" size={80} color="black" />
      <ThemedText style={styles.title}>Grocery List</ThemedText>
      
      {!isLoggedIn && (
        <View style={styles.warningContainer}>
          <MaterialIcons name="warning" size={20} color="#FF9800" />
          <Text style={styles.warningText}>
            Login to sync your grocery list across devices
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowAddInput(true)}
        >
          <AntDesign name="plus" size={16} color="white" />
          <Text style={styles.actionButtonText}>Add Item</Text>
        </TouchableOpacity>
        
        {checkedCount > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, styles.clearButton]}
            onPress={handleClearChecked}
          >
            <MaterialIcons name="clear" size={16} color="white" />
            <Text style={styles.actionButtonText}>Clear Checked ({checkedCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add Item Input */}
      {showAddInput && (
        <View style={styles.addInputContainer}>
          <TextInput
            style={styles.addInput}
            placeholder="Enter ingredient name..."
            value={newIngredient}
            onChangeText={setNewIngredient}
            autoFocus
            onSubmitEditing={handleAddIngredient}
          />
          <TouchableOpacity
            style={styles.addSubmitButton}
            onPress={handleAddIngredient}
          >
            <AntDesign name="check" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addCancelButton}
            onPress={() => {
              setShowAddInput(false);
              setNewIngredient('');
            }}
          >
            <AntDesign name="close" size={20} color="white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Grocery List */}
      {groceryItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No items in your grocery list yet.{'\n'}
            Add ingredients from recipes or manually add items!
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <Text style={styles.statsText}>
              {uncheckedCount} items remaining • {checkedCount} completed
            </Text>
          </View>
          
          <FlatList
            data={groceryItems}
            renderItem={renderGroceryItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
          
          {groceryItems.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAll}
            >
              <Text style={styles.clearAllText}>Clear All Items</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCE0',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    marginBottom: 20,
    fontSize: 28,
    fontWeight: 'bold',
    paddingTop: 5,
    marginTop: 10,
    color: '#3E1F15',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  warningText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#F57C00',
  },
  actionContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionButton: {
    backgroundColor: '#3E1F15',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  addInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  addInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#3E1F15',
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: 'white',
  },
  addSubmitButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 20,
  },
  addCancelButton: {
    backgroundColor: '#FF6B6B',
    padding: 8,
    borderRadius: 20,
  },
  statsContainer: {
    marginBottom: 15,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkboxContainer: {
    marginRight: 15,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: '#3E1F15',
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  deleteButton: {
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
    lineHeight: 24,
  },
  clearAllButton: {
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  clearAllText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  loading: {
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
});