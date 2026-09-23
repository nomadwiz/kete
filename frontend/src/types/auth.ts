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
