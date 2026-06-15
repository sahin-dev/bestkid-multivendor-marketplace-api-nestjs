import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Response } from "express";
import { map, Observable } from "rxjs";
import { ApiResponseMessageKey } from "../decorators/apiResponseMessage.decorator";

export interface ApiResponse<T> {
    success:true,
    message:string,
    statusCode:number,
    data:T
}
@Injectable()
export class ResponseTransformerInterceptor<T> implements NestInterceptor<T, ApiResponse<T>>{
   constructor(private readonly reflector:Reflector){}

    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<ApiResponse<T>> | Promise<Observable<ApiResponse<T>>> {
        
         const apiResponseMessage = this.reflector.getAllAndOverride(ApiResponseMessageKey, [context.getClass(), context.getHandler()])

        return next.handle().pipe(
            map(data => {
                const response = context.switchToHttp().getResponse<Response>()
      
                const code = response.statusCode
                return {
                    success:true,
                    statusCode:code,
                    message:apiResponseMessage,
                    data: data           
                }
                
            })
        )
    }
    
}