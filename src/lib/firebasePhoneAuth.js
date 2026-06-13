import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { requireFirebaseAuth } from './firebase';

let recaptchaVerifier = null;

export function getRecaptchaVerifier(containerId = 'recaptcha-container') {
  const auth = requireFirebaseAuth();

  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  });

  return recaptchaVerifier;
}

export async function sendPhoneOtp(phoneNumber, containerId = 'recaptcha-container') {
  const auth = requireFirebaseAuth();
  const verifier = getRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyPhoneOtp(confirmationResult, otpCode) {
  if (!confirmationResult) {
    throw new Error('Missing Firebase confirmation result. Send OTP before verifying the code.');
  }

  const credential = await confirmationResult.confirm(otpCode);
  const idToken = await credential.user.getIdToken();

  return {
    firebaseUser: credential.user,
    idToken,
    phoneNumber: credential.user.phoneNumber,
  };
}

export function resetRecaptchaVerifier() {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}
