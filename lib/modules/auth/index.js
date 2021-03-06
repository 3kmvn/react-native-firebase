/**
 * @flow
 * Auth representation wrapper
 */
import User from './User';
import ModuleBase from '../../utils/ModuleBase';
import { getAppEventName, SharedEventEmitter } from '../../utils/events';
import { getLogger } from '../../utils/log';
import { getNativeModule } from '../../utils/native';
import INTERNALS from '../../utils/internals';
import ConfirmationResult from './phone/ConfirmationResult';
import PhoneAuthListener from './phone/PhoneAuthListener';

// providers
import EmailAuthProvider from './providers/EmailAuthProvider';
import PhoneAuthProvider from './providers/PhoneAuthProvider';
import GoogleAuthProvider from './providers/GoogleAuthProvider';
import GithubAuthProvider from './providers/GithubAuthProvider';
import OAuthProvider from './providers/OAuthProvider';
import TwitterAuthProvider from './providers/TwitterAuthProvider';
import FacebookAuthProvider from './providers/FacebookAuthProvider';

import type {
  ActionCodeInfo,
  ActionCodeSettings,
  AuthCredential,
  NativeUser,
  NativeUserCredential,
  UserCredential,
} from './types';
import type App from '../core/app';

type AuthState = {
  user?: NativeUser,
};

const NATIVE_EVENTS = [
  'auth_state_changed',
  'auth_id_token_changed',
  'phone_auth_state_changed',
];

export const MODULE_NAME = 'RNFirebaseAuth';
export const NAMESPACE = 'auth';

export default class Auth extends ModuleBase {
  _authResult: boolean;
  _languageCode: string;
  _user: User | null;

  constructor(app: App) {
    super(app, {
      events: NATIVE_EVENTS,
      moduleName: MODULE_NAME,
      multiApp: true,
      hasShards: false,
      namespace: NAMESPACE,
    });
    this._user = null;
    this._authResult = false;
    this._languageCode =
      getNativeModule(this).APP_LANGUAGE[app._name] ||
      getNativeModule(this).APP_LANGUAGE['[DEFAULT]'];

    SharedEventEmitter.addListener(
      // sub to internal native event - this fans out to
      // public event name: onAuthStateChanged
      getAppEventName(this, 'auth_state_changed'),
      (state: AuthState) => {
        this._setUser(state.user);
        SharedEventEmitter.emit(
          getAppEventName(this, 'onAuthStateChanged'),
          this._user
        );
      }
    );

    SharedEventEmitter.addListener(
      // sub to internal native event - this fans out to
      // public events based on event.type
      getAppEventName(this, 'phone_auth_state_changed'),
      (event: Object) => {
        const eventKey = `phone:auth:${event.requestKey}:${event.type}`;
        SharedEventEmitter.emit(eventKey, event.state);
      }
    );

    SharedEventEmitter.addListener(
      // sub to internal native event - this fans out to
      // public event name: onIdTokenChanged
      getAppEventName(this, 'auth_id_token_changed'),
      (auth: AuthState) => {
        this._setUser(auth.user);
        SharedEventEmitter.emit(
          getAppEventName(this, 'onIdTokenChanged'),
          this._user
        );
      }
    );

    getNativeModule(this).addAuthStateListener();
    getNativeModule(this).addIdTokenListener();
  }

  _setUser(user: ?NativeUser): ?User {
    this._authResult = true;
    this._user = user ? new User(this, user) : null;
    SharedEventEmitter.emit(getAppEventName(this, 'onUserChanged'), this._user);
    return this._user;
  }

  _setUserCredential(userCredential: NativeUserCredential): UserCredential {
    const user = new User(this, userCredential.user);
    this._authResult = true;
    this._user = user;
    SharedEventEmitter.emit(getAppEventName(this, 'onUserChanged'), this._user);
    return {
      additionalUserInfo: userCredential.additionalUserInfo,
      user,
    };
  }

  /*
   * WEB API
   */

  /**
   * Listen for auth changes.
   * @param listener
   */
  onAuthStateChanged(listener: Function) {
    getLogger(this).info('Creating onAuthStateChanged listener');
    SharedEventEmitter.addListener(
      getAppEventName(this, 'onAuthStateChanged'),
      listener
    );
    if (this._authResult) listener(this._user || null);

    return () => {
      getLogger(this).info('Removing onAuthStateChanged listener');
      SharedEventEmitter.removeListener(
        getAppEventName(this, 'onAuthStateChanged'),
        listener
      );
    };
  }

  /**
   * Listen for id token changes.
   * @param listener
   */
  onIdTokenChanged(listener: Function) {
    getLogger(this).info('Creating onIdTokenChanged listener');
    SharedEventEmitter.addListener(
      getAppEventName(this, 'onIdTokenChanged'),
      listener
    );
    if (this._authResult) listener(this._user || null);

    return () => {
      getLogger(this).info('Removing onIdTokenChanged listener');
      SharedEventEmitter.removeListener(
        getAppEventName(this, 'onIdTokenChanged'),
        listener
      );
    };
  }

  /**
   * Listen for user changes.
   * @param listener
   */
  onUserChanged(listener: Function) {
    getLogger(this).info('Creating onUserChanged listener');
    SharedEventEmitter.addListener(
      getAppEventName(this, 'onUserChanged'),
      listener
    );
    if (this._authResult) listener(this._user || null);

    return () => {
      getLogger(this).info('Removing onUserChanged listener');
      SharedEventEmitter.removeListener(
        getAppEventName(this, 'onUserChanged'),
        listener
      );
    };
  }

  /**
   * Sign the current user out
   * @return {Promise}
   */
  signOut(): Promise<void> {
    return getNativeModule(this)
      .signOut()
      .then(() => {
        this._setUser();
      });
  }

  /**
   * Sign a user in anonymously
   * @deprecated Deprecated signInAnonymously in favor of signInAnonymouslyAndRetrieveData.
   * @return {Promise} A promise resolved upon completion
   */
  signInAnonymously(): Promise<User> {
    console.warn(
      'Deprecated firebase.User.prototype.signInAnonymously in favor of firebase.User.prototype.signInAnonymouslyAndRetrieveData.'
    );
    return getNativeModule(this)
      .signInAnonymously()
      .then(user => this._setUser(user));
  }

  /**
   * Sign a user in anonymously
   * @return {Promise} A promise resolved upon completion
   */
  signInAnonymouslyAndRetrieveData(): Promise<UserCredential> {
    return getNativeModule(this)
      .signInAnonymouslyAndRetrieveData()
      .then(userCredential => this._setUserCredential(userCredential));
  }

  /**
   * Create a user with the email/password functionality
   * @deprecated Deprecated createUserWithEmailAndPassword in favor of createUserAndRetrieveDataWithEmailAndPassword.
   * @param  {string} email    The user's email
   * @param  {string} password The user's password
   * @return {Promise}         A promise indicating the completion
   */
  createUserWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<User> {
    console.warn(
      'Deprecated firebase.User.prototype.createUserWithEmailAndPassword in favor of firebase.User.prototype.createUserAndRetrieveDataWithEmailAndPassword.'
    );
    return getNativeModule(this)
      .createUserWithEmailAndPassword(email, password)
      .then(user => this._setUser(user));
  }

  /**
   * Create a user with the email/password functionality
   * @param  {string} email    The user's email
   * @param  {string} password The user's password
   * @return {Promise}         A promise indicating the completion
   */
  createUserAndRetrieveDataWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return getNativeModule(this)
      .createUserAndRetrieveDataWithEmailAndPassword(email, password)
      .then(userCredential => this._setUserCredential(userCredential));
  }

  /**
   * Sign a user in with email/password
   * @deprecated Deprecated signInWithEmailAndPassword in favor of signInAndRetrieveDataWithEmailAndPassword
   * @param  {string} email    The user's email
   * @param  {string} password The user's password
   * @return {Promise}         A promise that is resolved upon completion
   */
  signInWithEmailAndPassword(email: string, password: string): Promise<User> {
    console.warn(
      'Deprecated firebase.User.prototype.signInWithEmailAndPassword in favor of firebase.User.prototype.signInAndRetrieveDataWithEmailAndPassword.'
    );
    return getNativeModule(this)
      .signInWithEmailAndPassword(email, password)
      .then(user => this._setUser(user));
  }

  /**
   * Sign a user in with email/password
   * @param  {string} email    The user's email
   * @param  {string} password The user's password
   * @return {Promise}         A promise that is resolved upon completion
   */
  signInAndRetrieveDataWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<UserCredential> {
    return getNativeModule(this)
      .signInAndRetrieveDataWithEmailAndPassword(email, password)
      .then(userCredential => this._setUserCredential(userCredential));
  }

  /**
   * Sign the user in with a custom auth token
   * @deprecated Deprecated signInWithCustomToken in favor of signInAndRetrieveDataWithCustomToken
   * @param  {string} customToken  A self-signed custom auth token.
   * @return {Promise}             A promise resolved upon completion
   */
  signInWithCustomToken(customToken: string): Promise<User> {
    console.warn(
      'Deprecated firebase.User.prototype.signInWithCustomToken in favor of firebase.User.prototype.signInAndRetrieveDataWithCustomToken.'
    );
    return getNativeModule(this)
      .signInWithCustomToken(customToken)
      .then(user => this._setUser(user));
  }

  /**
   * Sign the user in with a custom auth token
   * @param  {string} customToken  A self-signed custom auth token.
   * @return {Promise}             A promise resolved upon completion
   */
  signInAndRetrieveDataWithCustomToken(
    customToken: string
  ): Promise<UserCredential> {
    return getNativeModule(this)
      .signInAndRetrieveDataWithCustomToken(customToken)
      .then(userCredential => this._setUserCredential(userCredential));
  }

  /**
   * Sign the user in with a third-party authentication provider
   * @deprecated Deprecated signInWithCredential in favor of signInAndRetrieveDataWithCredential.
   * @return {Promise}           A promise resolved upon completion
   */
  signInWithCredential(credential: AuthCredential): Promise<User> {
    console.warn(
      'Deprecated firebase.User.prototype.signInWithCredential in favor of firebase.User.prototype.signInAndRetrieveDataWithCredential.'
    );
    return getNativeModule(this)
      .signInWithCredential(
        credential.providerId,
        credential.token,
        credential.secret
      )
      .then(user => this._setUser(user));
  }

  /**
   * Sign the user in with a third-party authentication provider
   * @return {Promise}           A promise resolved upon completion
   */
  signInAndRetrieveDataWithCredential(
    credential: AuthCredential
  ): Promise<UserCredential> {
    return getNativeModule(this)
      .signInAndRetrieveDataWithCredential(
        credential.providerId,
        credential.token,
        credential.secret
      )
      .then(userCredential => this._setUserCredential(userCredential));
  }

  /**
   * Asynchronously signs in using a phone number.
   *
   */
  signInWithPhoneNumber(phoneNumber: string): Promise<ConfirmationResult> {
    return getNativeModule(this)
      .signInWithPhoneNumber(phoneNumber)
      .then(result => new ConfirmationResult(this, result.verificationId));
  }

  /**
   * Returns a PhoneAuthListener to listen to phone verification events,
   * on the final completion event a PhoneAuthCredential can be generated for
   * authentication purposes.
   *
   * @param phoneNumber
   * @param autoVerifyTimeout Android Only
   * @returns {PhoneAuthListener}
   */
  verifyPhoneNumber(
    phoneNumber: string,
    autoVerifyTimeout?: number
  ): PhoneAuthListener {
    return new PhoneAuthListener(this, phoneNumber, autoVerifyTimeout);
  }

  /**
   * Send reset password instructions via email
   * @param {string} email The email to send password reset instructions
   */
  sendPasswordResetEmail(
    email: string,
    actionCodeSettings?: ActionCodeSettings
  ): Promise<void> {
    return getNativeModule(this).sendPasswordResetEmail(
      email,
      actionCodeSettings
    );
  }

  /**
   * Completes the password reset process, given a confirmation code and new password.
   *
   * @link https://firebase.google.com/docs/reference/js/firebase.auth.Auth#confirmPasswordReset
   * @param code
   * @param newPassword
   * @return {Promise.<Null>}
   */
  confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    return getNativeModule(this).confirmPasswordReset(code, newPassword);
  }

  /**
   * Applies a verification code sent to the user by email or other out-of-band mechanism.
   *
   * @link https://firebase.google.com/docs/reference/js/firebase.auth.Auth#applyActionCode
   * @param code
   * @return {Promise.<Null>}
   */
  applyActionCode(code: string): Promise<void> {
    return getNativeModule(this).applyActionCode(code);
  }

  /**
   * Checks a verification code sent to the user by email or other out-of-band mechanism.
   *
   * @link https://firebase.google.com/docs/reference/js/firebase.auth.Auth#checkActionCode
   * @param code
   * @return {Promise.<any>|Promise<ActionCodeInfo>}
   */
  checkActionCode(code: string): Promise<ActionCodeInfo> {
    return getNativeModule(this).checkActionCode(code);
  }

  /**
   * Returns a list of authentication providers that can be used to sign in a given user (identified by its main email address).
   * @return {Promise}
   */
  fetchProvidersForEmail(email: string): Promise<string[]> {
    return getNativeModule(this).fetchProvidersForEmail(email);
  }

  verifyPasswordResetCode(code: string): Promise<string> {
    return getNativeModule(this).verifyPasswordResetCode(code);
  }

  /**
   * Sets the language for the auth module
   * @param code
   * @returns {*}
   */
  set languageCode(code: string) {
    this._languageCode = code;
    getNativeModule(this).setLanguageCode(code);
  }

  /**
   * Get the currently signed in user
   * @return {Promise}
   */
  get currentUser(): User | null {
    return this._user;
  }

  get languageCode(): string {
    return this._languageCode;
  }

  /**
   * KNOWN UNSUPPORTED METHODS
   */

  getRedirectResult() {
    throw new Error(
      INTERNALS.STRINGS.ERROR_UNSUPPORTED_MODULE_METHOD(
        'auth',
        'getRedirectResult'
      )
    );
  }

  setPersistence() {
    throw new Error(
      INTERNALS.STRINGS.ERROR_UNSUPPORTED_MODULE_METHOD(
        'auth',
        'setPersistence'
      )
    );
  }

  signInWithPopup() {
    throw new Error(
      INTERNALS.STRINGS.ERROR_UNSUPPORTED_MODULE_METHOD(
        'auth',
        'signInWithPopup'
      )
    );
  }

  signInWithRedirect() {
    throw new Error(
      INTERNALS.STRINGS.ERROR_UNSUPPORTED_MODULE_METHOD(
        'auth',
        'signInWithRedirect'
      )
    );
  }

  // firebase issue - https://github.com/invertase/react-native-firebase/pull/655#issuecomment-349904680
  useDeviceLanguage() {
    throw new Error(
      INTERNALS.STRINGS.ERROR_UNSUPPORTED_MODULE_METHOD(
        'auth',
        'useDeviceLanguage'
      )
    );
  }
}

export const statics = {
  EmailAuthProvider,
  PhoneAuthProvider,
  GoogleAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  PhoneAuthState: {
    CODE_SENT: 'sent',
    AUTO_VERIFY_TIMEOUT: 'timeout',
    AUTO_VERIFIED: 'verified',
    ERROR: 'error',
  },
};
