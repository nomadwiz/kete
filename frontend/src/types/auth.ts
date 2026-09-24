export interface Register {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
}

// POST /register answers with the new user's id and no token, so registering
// does not sign anyone in.
export interface RegisterResult {
  user_id: number;
}

export interface SignIn {
  username_or_email: string;
  password: string;
}

export interface SignInResult {
  token: string;
  user_id: number;
}
