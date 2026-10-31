import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY } from "src/common/decorators/public.decorator";
import { AuthProvider } from "../providers/AuthProvider";

@Injectable()
export class JwtGuard implements CanActivate {

    constructor(
        private readonly reflector: Reflector,
        private readonly authProvider: AuthProvider,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()

        const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

        if (isPublic) {
            const authorization = request.headers.authorization;
            if (!authorization) {
                return true
            }

            try {
                const token = this.extractToken(request)
                await this.attachUserToRequest(request, token)
            } catch {
                return true
            }

            return true
        }

        try {
            const token = this.extractToken(request)
            await this.attachUserToRequest(request, token)

            return true

        } catch (err) {
            if (err instanceof ForbiddenException) {
                throw err
            }
            throw new UnauthorizedException("Invalid token!")
        }

    }

    private extractToken(request: Request) {

        if (!request.headers.authorization) {
            throw new UnauthorizedException("authorization header missing")
        }
        const [type, token] = request.headers.authorization?.split(" ") || []

        if (type !== "Bearer")
            throw new UnauthorizedException("token type is not valid")
        if (!token) {
            throw new UnauthorizedException("token is missing")
        }

        return token
    }

    private async attachUserToRequest(request: Request, token: string) {
        const user = await this.authProvider.verifyToken(token)

        if (user.is_blocked) {
            throw new ForbiddenException('Sorry, your are blocked by the admin.Kindly, Contact support.Thanks')
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
    }


}
