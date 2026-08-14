import { Module } from '@nestjs/common';

import { FirmwareController } from './firmware.controller';

@Module({
  controllers: [FirmwareController],
})
export class FirmwareModule {}
