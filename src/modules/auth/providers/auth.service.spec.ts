import { Test, TestingModule } from '@nestjs/testing';

jest.mock('./user.service', () => ({
  UserService: class UserService {},
}));

jest.mock('./AuthProvider', () => ({
  AuthProvider: class AuthProvider {},
}));

jest.mock('src/common/providres/OtpGenerator.provider', () => ({
  OtpService: class OtpService {},
}));

import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthProvider } from './AuthProvider';
import { OtpService } from 'src/common/providres/OtpGenerator.provider';
import { SMTPProvider } from 'src/common/providres/smtp.provider';
import { EncoderProvider } from './encoder.provider';
import { OtpPurpose } from 'generated/prisma/enums';

describe('AuthService.verifyOtp', () => {
  let service: AuthService;
  let userService: { emailVerified: jest.Mock; getUserByEmail: jest.Mock };
  let authProvider: { signToken: jest.Mock };
  let otpService: { verifyOtp: jest.Mock; create: jest.Mock };
  let smtpProvider: { sendMail: jest.Mock };

  beforeEach(async () => {
    userService = {
      emailVerified: jest.fn().mockResolvedValue({
        id: 42,
        email: 'user@example.com',
        role: 'USER',
        profile: { full_name: 'Test User' },
      }),
      getUserByEmail: jest.fn().mockResolvedValue({
        id: 42,
        email: 'user@example.com',
        profile: { full_name: 'Test User' },
      }),
    };
    authProvider = {
      signToken: jest.fn().mockReturnValue('jwt-token'),
    };
    otpService = {
      verifyOtp: jest.fn().mockResolvedValue({ userId: 42, purpose: OtpPurpose.EMAIL_VERIFICATION }),
      create: jest.fn().mockResolvedValue({ otp: '123456', requestId: 'req-reset' }),
    };
    smtpProvider = { sendMail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: AuthProvider, useValue: authProvider },
        { provide: OtpService, useValue: otpService },
        { provide: SMTPProvider, useValue: smtpProvider },
        { provide: EncoderProvider, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('marks the user email as verified when the OTP is for email verification', async () => {
    const result = await service.verifyOtp({ requestId: 'req-1', otp: '123456' } as any);

    expect(otpService.verifyOtp).toHaveBeenCalledWith('req-1', '123456');
    expect(userService.emailVerified).toHaveBeenCalledWith(42);
    expect(authProvider.signToken).toHaveBeenCalledWith({
      id: 42,
      email: 'user@example.com',
      role: 'USER',
    });
    expect(result).toEqual({
      userId: 42,
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      access_token: 'jwt-token',
    });
  });

  it('does not issue a JWT when the OTP is not for email verification', async () => {
    otpService.verifyOtp.mockResolvedValueOnce({
      requestId: 'req-reset',
      userId: 42,
      purpose: OtpPurpose.RESET_PASSWORD,
    });

    const result = await service.verifyOtp({ requestId: 'req-reset', otp: '123456' } as any);

    expect(userService.emailVerified).not.toHaveBeenCalled();
    expect(authProvider.signToken).not.toHaveBeenCalled();
    expect(result).toEqual({
      requestId: 'req-reset',
      userId: 42,
      purpose: OtpPurpose.RESET_PASSWORD,
    });
  });

  it('resends a password reset OTP for a registered user', async () => {
    const result = await service.resendForgotPasswordOtp({ email: 'user@example.com' } as any);

    expect(userService.getUserByEmail).toHaveBeenCalledWith('user@example.com');
    expect(otpService.create).toHaveBeenCalled();
    expect(smtpProvider.sendMail).toHaveBeenCalled();
    expect(result).toEqual({ message: 'If that email is registered, an OTP has been sent.', requestId: 'req-reset' });
  });
});
