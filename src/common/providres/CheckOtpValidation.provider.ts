// import { Otp } from "generated/prisma/client";

// export class CheckOtpValidation {


//     static check(code:number, otp:Otp):boolean{

//         if(otp.expires_in < new Date(Date.now())){
//             return false
//         }

//         if(otp.code !== code){
//            return false
//         }

//         return true
//     }
// }