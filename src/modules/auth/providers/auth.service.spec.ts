import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthProvider } from './AuthProvider';
import { OtpService } from 'src/common/providres/OtpGenerator.provider';
import { SMTPProvider } from 'src/common/providres/smtp.provider';
import { EncoderProvider } from './encoder.provider';
import { OtpPurpose } from 'generated/prisma/enums';

describe('AuthService.verifyOtp', () => {
  let service: AuthService;
  let userService: { emailVerified: jest.Mock };
  let otpService: { verifyOtp: jest.Mock };

  beforeEach(async () => {
    userService = { emailVerified: jest.fn().mockResolvedValue(undefined) };
    otpService = { verifyOtp: jest.fn().mockResolvedValue({ userId: 42, purpose: OtpPurpose.EMAIL_VERIFICATION }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: AuthProvider, useValue: {} },
        { provide: OtpService, useValue: otpService },
        { provide: SMTPProvider, useValue: {} },
        { provide: EncoderProvider, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('marks the user email as verified when the OTP is for email verification', async () => {
    await service.verifyOtp({ requestId: 'req-1', otp: '123456' } as any);

    expect(otpService.verifyOtp).toHaveBeenCalledWith('req-1', '123456');
    expect(userService.emailVerified).toHaveBeenCalledWith(42);
  });
});
