import { StyleSheet, Image, View, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button, Divider, Text } from '@rneui/themed';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useFavorites } from '@/context/FavoritesContext';

// Type guard for Firebase Error
function isFirebaseError(error: unknown): error is FirebaseError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ButtonsComponentProps = {
  email: string;
  password: string;
  loading: boolean;
  handleLogin: () => void;
  handleRegister: () => void;
};

const Buttons: React.FunctionComponent<ButtonsComponentProps> = ({ 
  email, 
  password, 
  loading, 
  handleLogin, 
  handleRegister 
}) => {
  // Validate email format
  const isEmailValid = email ? emailRegex.test(email) : false;
  // Check if password meets minimum requirements
  const isPasswordValid = password ? password.length >= 6 : false;
  
  const isFormValid = isEmailValid && isPasswordValid;
  
  return (
    <View style={styles.buttonsContainer}>
      <Button
        title="Register"
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
        title="Log In"
        loading={loading}
        disabled={!isFormValid || loading}
        onPress={handleLogin}
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
    </View>
  );
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();
  const { syncFavorites, setIsLoggedIn } = useFavorites();

  // Check for auth state changes
  useEffect(() => {
    if (!auth) {
      console.error('Firebase auth is not initialized');
      setAuthChecked(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);
      
      if (user) {
        setIsLoggedIn(true);
        
        syncFavorites().then(() => {
          router.replace('/(tabs)/search');
        }).catch(error => {
          console.error('Error syncing favorites during auto-login:', error);
          router.replace('/(tabs)/search');
        });
      } else {
        console.log('No user is signed in');
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Validate email
  const validateEmail = (text: string) => {
    setEmail(text);
    if (text && !emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Validate password
  const validatePassword = (text: string) => {
    setPassword(text);
    if (text && text.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };

  // Handle email/password login with improved error handling
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (!auth) {
      console.error('Firebase auth is not initialized');
      Alert.alert('Error', 'Authentication service is not available');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('User logged in:', userCredential.user.uid);
      
      setIsLoggedIn(true);
      
      await syncFavorites().catch(error => {
        console.error('Error syncing favorites during login:', error);
      });
      
      router.replace('/(tabs)/search');
    } catch (error) {
      console.error('Login error:', error);
      
      if (isFirebaseError(error)) {
        switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
            break;
          case 'auth/too-many-requests':
            Alert.alert('Login Failed', 'Too many failed login attempts. Please try again later or reset your password.');
            break;
          case 'auth/user-disabled':
            Alert.alert('Login Failed', 'This account has been disabled. Please contact support.');
            break;
          case 'auth/network-request-failed':
            Alert.alert('Network Error', 'Please check your internet connection and try again.');
            break;
          default:
            Alert.alert('Login Failed', error.message || 'Failed to log in. Please try again.');
        }
      } else {
        Alert.alert('Login Failed', 'An unknown error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle registration navigation
  const handleRegister = () => {
    router.push('./register');
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    if (email && emailRegex.test(email)) {
      try {
        setLoading(true);
        await sendPasswordResetEmail(auth, email.trim());
        Alert.alert(
          'Password Reset Email Sent',
          'Check your email for instructions to reset your password.'
        );
      } catch (error) {
        console.error('Password reset error:', error);
        if (isFirebaseError(error)) {
          if (error.code === 'auth/user-not-found') {
            Alert.alert('Password Reset Failed', 'No account exists with this email address.');
          } else {
            Alert.alert(
              'Password Reset Failed',
              error.message || 'Failed to send password reset email. Please try again.'
            );
          }
        } else {
          Alert.alert('Password Reset Failed', 'An unknown error occurred.');
        }
      } finally {
        setLoading(false);
      }
    } else {
      router.push('./forgot-password');
    }
  };

  return (
    <View style={styles.outerContainer}>
      <KeyboardAvoidingView 
        style={styles.screen} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <ThemedView style={styles.contentContainer}>
            <ThemedView style={styles.inputContainer}>
              <Image
                source={require('@/assets/images/recipeRabbitLogo.png')}
                style={{ width: 150, height: 150, marginTop: 80 }}
              />
              <ThemedText type="italicTitle">Recipe Rabbit</ThemedText>
            </ThemedView>

            <ThemedView style={styles.container}>
              <ThemedText type="defaultSemiBold">Email</ThemedText>
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <TextInput
                style={[styles.input, emailError ? styles.inputError : null]}
                placeholder="Email"
                value={email}
                onChangeText={validateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                blurOnSubmit={false}
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </ThemedView>
            
            <ThemedView style={styles.container}>
              <ThemedText type="defaultSemiBold">Password</ThemedText>
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <TextInput
                style={[styles.input, passwordError ? styles.inputError : null]}
                placeholder="Password"
                value={password}
                onChangeText={validatePassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </ThemedView>

            <ThemedView style={styles.inputContainer}>
              <ThemedText 
                type="link" 
                onPress={handleForgotPassword}
              >
                Forgot Password?
              </ThemedText>
            </ThemedView>
            
            <Buttons 
              email={email}
              password={password}
              loading={loading}
              handleLogin={handleLogin}
              handleRegister={handleRegister}
            />
            
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#FFFCE0',
  },
  screen: {
    flex: 1,
    backgroundColor: '#FFFCE0',
  },
  scrollView: {
    backgroundColor: '#FFFCE0',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
    backgroundColor: '#FFFCE0',
  },
  contentContainer: {
    backgroundColor: '#FFFCE0',
    minHeight: '100%',
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
    backgroundColor: '#FFFCE0',
  },
  buttonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 20,
  },
  container: {
    marginTop: 20,
    marginLeft: 50,
    marginBottom: 10,
    backgroundColor: '#FFFCE0',
  },
});