import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { requireFirebaseAuth } from './firebase';

let recaptchaVerifier = null;
const DEFAULT_RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha-container';

function resetRecaptchaContainer(containerId = DEFAULT_RECAPTCHA_CONTAINER_ID) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

export function getRecaptchaVerifier(containerId = DEFAULT_RECAPTCHA_CONTAINER_ID) {
  const auth = requireFirebaseAuth();

  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }

  resetRecaptchaContainer(containerId);

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    'expired-callback': () => {
      resetRecaptchaVerifier();
    },
  });

  return recaptchaVerifier;
}

export async function sendPhoneOtp(phoneNumber, containerId = DEFAULT_RECAPTCHA_CONTAINER_ID) {
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
  resetRecaptchaContainer();
}
