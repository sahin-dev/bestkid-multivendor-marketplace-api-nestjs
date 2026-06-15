import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'Public';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
