import { StyleSheet, View, TextInput, Alert, ScrollView, BackHandler, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@rneui/themed';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

import { FirebaseError } from 'firebase/app';

function isFirebaseError(error: unknown): error is FirebaseError {
    return typeof error === 'object' && error !== null && 'code' in error;
}

// Email and password validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Error states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  const router = useRouter();

  // Add back button handling
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  // Validate email
  const validateEmail = (text: string) => {
    setEmail(text);
    if (!text.trim()) {
      setEmailError('Email is required');
    } else if (!emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Validate password
  const validatePassword = (text: string) => {
    setPassword(text);
    if (!text) {
      setPasswordError('Password is required');
    } else if (!passwordRegex.test(text)) {
      setPasswordError('Password must be at least 8 characters with letters and numbers');
    } else {
      setPasswordError('');
    }
    
    // Also check confirm password match if it has a value
    if (confirmPassword && text !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else if (confirmPassword) {
      setConfirmPasswordError('');
    }
  };

  // Validate confirm password
  const validateConfirmPassword = (text: string) => {
    setConfirmPassword(text);
    if (!text) {
      setConfirmPasswordError('Please confirm your password');
    } else if (text !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  // Handle registration
  const handleRegister = async () => {
    // Validate all fields before proceeding
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    
    if (!password) {
      setPasswordError('Password is required');
      return;
    }
    
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      return;
    }
    
    // Check for validation errors
    if (emailError || passwordError || confirmPasswordError) {
      return;
    }

    // Check if firebase auth is initialized
    if (!auth) {
      console.error('Firebase auth is not initialized');
      Alert.alert('Error', 'Authentication service is not available');
      return;
    }

    try {
      setLoading(true);
      console.log('Starting user registration process');
      
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      console.log('User created successfully:', user.uid);
      
      try {
        // Store additional user data in Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: email.trim(),
          createdAt: new Date().toISOString(),
          favorites: [],
          recipeCount: 0,
        });
        console.log('User data stored in Firestore');
        
        // Send email verification
        await sendEmailVerification(user);
        console.log('Verification email sent');
        
        // Show success message
        Alert.alert(
          'Registration Successful!', 
          'Your account has been created and a verification email has been sent.',
          [{ 
            text: 'OK', 
            onPress: () => {
              console.log('Navigating to search page after registration');
              router.replace('/(tabs)/search'); 
            }
          }]
        );
        
      } catch (firestoreError) {
        console.error('Firestore error:', firestoreError);
        
        Alert.alert(
          'Account Created',
          'Your account was created but we had trouble setting up your profile. You will be signed in anyway.',
          [{ 
            text: 'OK', 
            onPress: () => router.replace('/(tabs)/search')
          }]
        );
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (isFirebaseError(error)) {
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = 'This email address is already in use.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'The email address is not valid.';
        } else if (error.code === 'auth/weak-password') {
          errorMessage = 'The password is too weak.';
        } else if (error.code === 'auth/operation-not-allowed') {
          errorMessage = 'Email/password accounts are not enabled. Please contact support.';
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        console.log('Firebase error code:', error.code);
        Alert.alert('Registration Failed', errorMessage);
      } else {
        console.log('Non-Firebase error:', error);
        Alert.alert('Registration Failed', 'An unknown error occurred.');
      }
    
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.screen} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedView>
          <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>Create Account</ThemedText>
            <ThemedText type="default" style={styles.subtitle}>
              Join Recipe Rabbit to discover and save your favorite recipes!
            </ThemedText>
          </ThemedView>

          {/* Email Input */}
          <ThemedView style={styles.labelContainer}>
            <ThemedText type="defaultSemiBold">Email</ThemedText>
          </ThemedView>
          <ThemedView style={styles.inputContainer}>
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              placeholder="Email Address"
              value={email}
              onChangeText={validateEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              blurOnSubmit={false}
            />
            {emailError ? <ThemedText style={styles.errorText}>{emailError}</ThemedText> : null}
          </ThemedView>

          {/* Password Input */}
          <ThemedView style={styles.labelContainer}>
            <ThemedText type="defaultSemiBold">Password</ThemedText>
          </ThemedView>
          <ThemedView style={styles.inputContainer}>
            <TextInput
              style={[styles.input, passwordError ? styles.inputError : null]}
              placeholder="Password (8+ characters, letters & numbers)"
              value={password}
              onChangeText={validatePassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              returnKeyType="next"
              blurOnSubmit={false}
            />
            {passwordError ? <ThemedText style={styles.errorText}>{passwordError}</ThemedText> : null}
          </ThemedView>

          {/* Confirm Password Input */}
          <ThemedView style={styles.labelContainer}>
            <ThemedText type="defaultSemiBold">Confirm Password</ThemedText>
          </ThemedView>
          <ThemedView style={styles.inputContainer}>
            <TextInput
              style={[styles.input, confirmPasswordError ? styles.inputError : null]}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={validateConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            {confirmPasswordError ? <ThemedText style={styles.errorText}>{confirmPasswordError}</ThemedText> : null}
          </ThemedView>

          {/* Register Button */}
          <ThemedView style={styles.buttonsContainer}>
            <Button
              title="Create Account"
              loading={loading}
              disabled={!email || !password || !confirmPassword || loading || 
                      !!emailError || !!passwordError || !!confirmPasswordError}
              onPress={handleRegister}
              buttonStyle={{
                backgroundColor: '#3E1F15',
                borderWidth: 2,
                borderColor: 'white',
                borderRadius: 30,
              }}
              containerStyle={{
                width: 200,
                marginHorizontal: 50,
                marginBottom: 5,
              }}
              titleStyle={{ fontWeight: 'bold' }}
            />
            <Button
              title="Already have an account? Log In"
              type="clear"
              onPress={() => {
                console.log('Going back to login screen');
                router.back();
              }}
              titleStyle={{ color: '#3E1F15' }}
              containerStyle={{
                marginTop: 10,
                marginBottom: 30
              }}
            />
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFCE0',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    marginVertical: 20,
    marginHorizontal: 20,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    textAlign: 'center',
    marginVertical: 20,
  },
  labelContainer: {
    marginLeft: 50,
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: 'black',
    borderWidth: 1,
    borderRadius: 20,
    width: 330,
    backgroundColor: 'white',
    paddingHorizontal: 10,
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  inputContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 15,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
  },
});