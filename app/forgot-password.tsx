import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@rneui/themed';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';

import { FirebaseError } from 'firebase/app'; // Import FirebaseError

function isFirebaseError(error: unknown): error is FirebaseError {
    return typeof error === 'object' && error !== null && 'code' in error;
}

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const router = useRouter();

  // Validate email
  const validateEmail = (text: string) => {
    setEmail(text);
    if (text && !emailRegex.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!email) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for instructions to reset your password.',
        [
          {
            text: 'OK',
            onPress: () => router.back() // Go back to login screen
          }
        ]
      );
    } catch (error) {
      console.error('Password reset error:', error);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
    if (isFirebaseError(error)) {
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account exists with this email address.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'The email address is not valid.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many requests. Please try again later.';
        }
        
        Alert.alert('Password Reset Failed', errorMessage);
    } else {
        Alert.alert('Registration Failed', 'An unknown error occurred.');
    }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ThemedView>
        <ThemedView style={styles.container}>
          <ThemedText type="title" style={styles.title}>Reset Password</ThemedText>
          <ThemedText type="default" style={styles.subtitle}>
            Enter your email address and we'll send you instructions to reset your password.
          </ThemedText>
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
          />
          {emailError ? <ThemedText style={styles.errorText}>{emailError}</ThemedText> : null}
        </ThemedView>

        <ThemedView style={styles.buttonsContainer}>
          <Button
            title="Send Reset Link"
            loading={loading}
            disabled={!email || !!emailError || loading}
            onPress={handlePasswordReset}
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
            title="Back to Login"
            type="clear"
            onPress={() => router.back()}
            titleStyle={{ color: '#3E1F15' }}
            containerStyle={{
              marginTop: 10
            }}
          />
        </ThemedView>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFCE0',
  },
  container: {
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginTop: 60,
  },
  subtitle: {
    textAlign: 'center',
    marginVertical: 20,
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
    fontSize: 12,
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  inputContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 15,
    marginVertical: 20,
  },
  buttonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 20,
  },
});