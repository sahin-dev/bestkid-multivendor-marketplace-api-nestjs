import { Injectable } from '@nestjs/common'
import bcrypt from 'bcrypt'

@Injectable()
export class EncoderProvider {

    async hashPassword(password: string, salt: number) {
        return await bcrypt.hash(password, salt)
    }

    async compare(password: string, hashed: string) {
        return await bcrypt.compare(password, hashed)
    }

}