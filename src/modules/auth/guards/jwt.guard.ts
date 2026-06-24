import { BadRequestException, CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { TokenPayload } from "../types/TokenPayload.type"
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY } from "src/common/decorators/public.decorator";

import { type ConfigType } from "@nestjs/config";
import jwtConfig from "src/config/jwt.config";
import { AuthProvider } from "../providers/AuthProvider";

@Injectable()
export class JwtGuard implements CanActivate {

    constructor(private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly authProvider: AuthProvider,
        @Inject(jwtConfig.KEY)
        private readonly jwtConfigOptions: ConfigType<typeof jwtConfig>
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()

        const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

        if (isPublic) {
            return true
        }

        try {
            const token = this.extractToken(request)

            const user = await this.authProvider.verifyToken(token)

            if (user.is_blocked) {
                throw new BadRequestException('Sorry, your are blocked by the admin.Kindly, Contact support.Thanks')
            }

            // if(user.is_deleted){
            //     throw new BadRequestException('Sorry, your account has been deleted. If you think this is a mistake, please contact support.Thanks')
            // }

            request['user'] = user;
            request['payload'] = {
                id: user.id,
                role: user.role,
                email: user.email
            };

            return true

        } catch (err) {
            throw new BadRequestException("Invalid token!")
        }

    }

    private extractToken(request: Request) {

        if (!request.headers.authorization) {
            throw new BadRequestException("authorization header missing")
        }
        const [type, token] = request.headers.authorization?.split(" ") || []

        if (type !== "Bearer")
            throw new UnauthorizedException("token type is not valid")
        if (!token) {
            throw new UnauthorizedException("token is missing")
        }

        return token
    }


}