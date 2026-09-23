export interface SignIn {
  username_or_email: string;
  password: string;
}

// POST /login answers with the credential itself. The field is `token`, not
// `access_token`, and there is no `token_type` and no refresh token.
export interface SignInResult {
  token: string;
  user_id: number;
}

export interface SignUp {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
}

// POST /register issues no token, so registering does not sign anyone in — a
// new account signs in through POST /login like any other.
export interface SignUpResult {
  user_id: number;
}
