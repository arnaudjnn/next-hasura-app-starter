import NextAuth from "next-auth";
import Providers from "next-auth/providers";
import jwt from "jsonwebtoken";
import { NextApiRequest, NextApiResponse } from "next";
import ISession from "types/session";
import IUser from "types/user";
import iToken from "types/token";

const jwtSecret = JSON.parse(process.env.AUTH_PRIVATE_KEY);
const environment = process.env.NODE_ENV;
const isProduction = environment === 'production';
let database = {
  type: process.env.NEXT_PUBLIC_DATABASE_TYPE,
  host: process.env.NEXT_PUBLIC_DATABASE_HOST,
  port: process.env.NEXT_PUBLIC_DATABASE_PORT,
  username: process.env.NEXT_PUBLIC_DATABASE_USERNAME,
  password: process.env.NEXT_PUBLIC_DATABASE_PASSWORD,
  database: process.env.NEXT_PUBLIC_DATABASE_NAME,
}
if (!isProduction) {
  database = {
    ...database,
    ssl: true,
    extra: {
      ssl: {
        rejectUnauthorized: false
      },
    }
  }
}

const options = {
  providers: [
    Providers.Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }),
  ],
  database,
  session: {
    jwt: true,
  },
  jwt: {
    encode: async ({ token, secret }: { token: iToken; secret: string }) => {
      const tokenContents = {
        id: token.id,
        name: token.name,
        email: token.email,
        picture: token.picture,
        "https://hasura.io/jwt/claims": {
          "x-hasura-allowed-roles": ["admin", "user"],
          "x-hasura-default-role": "user",
          "x-hasura-role": "user",
          "x-hasura-user-id": token.id,
        },
        iat: Date.now() / 1000,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        sub: token.id,
      };

      const encodedToken = jwt.sign(tokenContents, jwtSecret.key, {
        algorithm: jwtSecret.type,
      });

      return encodedToken;
    },
    decode: async ({ token, secret }: { token: string; secret: string }) => {
      const decodedToken = jwt.verify(token, jwtSecret.key, {
        algorithms: jwtSecret.type,
      });

      return decodedToken;
    },
  },
  debug: true,
  callbacks: {
    session: async (session: ISession, user: IUser) => {
      const encodedToken = jwt.sign(user, jwtSecret.key, {
        algorithm: jwtSecret.type,
      });

      session.id = user.id;
      session.token = encodedToken;

      return Promise.resolve(session);
    },
    jwt: async (token: iToken, user: IUser, account, profile, isNewUser) => {
      const isSignIn = user ? true : false;

      if (isSignIn) {
        token.id = user.id;
      }

      return Promise.resolve(token);
    },
  },
};

const Auth = (req: NextApiRequest, res: NextApiResponse) =>
  NextAuth(req, res, options);

export default Auth;
