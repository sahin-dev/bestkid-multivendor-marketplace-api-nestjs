import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

@Catch(HttpException)
export class GlobalHttpExceptionHandler implements ExceptionFilter{

    catch(exception: any, host: ArgumentsHost) {

        // if(exception instanceof HttpException) return

        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        const status = exception.getStatus() || HttpStatus.INTERNAL_SERVER_ERROR
        const url = request.url

        const exceptionResponse = exception.getResponse() || {message: 'Internal server error!'}
        
        response.status(status)
        .json(
            {
                success: false,
                message:exceptionResponse['message'],
                url,
                statusCode:status
            }
        )
    }

}