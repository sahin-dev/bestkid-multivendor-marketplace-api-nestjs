import { User } from "src/modules/auth/models/User";
import { TokenPayload } from "../auth/types/TokenPayload.type";

declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}
