import { describe, expect, it, vi } from 'vitest';
import { browser } from 'wxt/browser';
import {
  hasClayPermission,
  requestClayPermission,
  revokeClayPermission,
} from '@/platform/permissions';
import { CLAY_ORIGIN_PATTERN } from '@/shared/constants';

interface TestPermissionsApi {
  request(permissions: { origins: string[] }): Promise<boolean>;
  contains(permissions: { origins: string[] }): Promise<boolean>;
  remove(permissions: { origins: string[] }): Promise<boolean>;
}

describe('optional Clay permission', () => {
  it('requests, checks, and revokes only the Clay API origin', async () => {
    const permissions = browser.permissions as unknown as TestPermissionsApi;
    const request = vi.spyOn(permissions, 'request').mockResolvedValue(false);
    const contains = vi.spyOn(permissions, 'contains').mockResolvedValue(true);
    const remove = vi.spyOn(permissions, 'remove').mockResolvedValue(true);

    await expect(requestClayPermission()).resolves.toBe(false);
    await expect(hasClayPermission()).resolves.toBe(true);
    await expect(revokeClayPermission()).resolves.toBe(true);

    const expected = { origins: [CLAY_ORIGIN_PATTERN] };
    expect(request).toHaveBeenCalledWith(expected);
    expect(contains).toHaveBeenCalledWith(expected);
    expect(remove).toHaveBeenCalledWith(expected);
  });
});
