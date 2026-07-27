import { handleRuntimeMessage, isRuntimeMessage } from '@/background/messages';
import { registerRuntimeMessageHandler } from '@/platform/runtime';
import { protectLocalStorage } from '@/platform/storage/app-state';

export default defineBackground(() => {
  void protectLocalStorage();
  registerRuntimeMessageHandler((message) => {
    if (!isRuntimeMessage(message)) return undefined;
    return handleRuntimeMessage(message);
  });
});
