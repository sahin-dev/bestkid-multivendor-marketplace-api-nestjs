import { randomUUID, UUID } from "node:crypto";

export class UUIdProvider{

    getUUid():string{
        return randomUUID().toString()
    }

}