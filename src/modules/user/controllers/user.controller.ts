import { Body, Controller } from "@nestjs/common";
import { UserService } from "../../auth/providers/user.service";
import { RegisterUserDto } from "src/modules/auth/dtos/register.dto";

@Controller("users")
export class UserController {

    constructor(private readonly userService: UserService){}

    
}