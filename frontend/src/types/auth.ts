export interface SignIn {
  username_or_email: string;
  password: string;
}

export interface SignInResult {
  token: string;
  user_id: number;
}
