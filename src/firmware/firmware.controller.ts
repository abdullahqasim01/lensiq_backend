import { Controller, Get, Query } from '@nestjs/common';

export interface FirmwareLatestResponse {
  deviceClass: string;
  /** `null` when no known-latest version is configured for this device class. */
  version: string | null;
  notes: string | null;
}

/**
 * Reports the latest known-good firmware version per glasses model, so the
 * Home screen can show a "firmware update available" banner (see
 * `docs/plan/08-home-dashboard-extras.md` §8.1). There is no OTA
 * infrastructure on the native side to compare against (confirmed via
 * `docs/heycyan-reference/08-ota-firmware.md` — the original app's
 * `getLastOta` check has no equivalent here), so this is deliberately
 * simple: an operator sets `FIRMWARE_LATEST_VERSION[_<DEVICE_CLASS>]` env
 * vars when a new firmware build ships, and the client compares it against
 * the version the glasses already report over BLE. Performing the actual
 * update (WiFi-Direct transfer) is out of scope here — see
 * `docs/plan/09-hardware-settings-and-ota.md` §9.7.
 */
@Controller('firmware')
export class FirmwareController {
  @Get('latest')
  getLatest(
    @Query('deviceClass') deviceClass?: string,
  ): FirmwareLatestResponse {
    const normalized = deviceClass?.trim() || 'default';
    const specificKey = `FIRMWARE_LATEST_VERSION_${envSuffix(normalized)}`;
    const version =
      process.env[specificKey]?.trim() ||
      process.env.FIRMWARE_LATEST_VERSION?.trim() ||
      null;

    return {
      deviceClass: normalized,
      version: version || null,
      notes: process.env.FIRMWARE_RELEASE_NOTES?.trim() || null,
    };
  }
}

function envSuffix(deviceClass: string): string {
  return deviceClass.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}
