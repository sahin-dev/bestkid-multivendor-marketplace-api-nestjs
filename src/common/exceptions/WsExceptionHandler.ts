import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch(WsException)
export class WsExceptionsFilter extends BaseWsExceptionFilter {

    catch(exception: WsException, host: ArgumentsHost) {
        const client = host.switchToWs().getClient();
        const error = exception.getError();
        Logger.error(`WebSocket Exception: ${JSON.stringify(error)}`);
        super.catch(exception, host);
    }
}
