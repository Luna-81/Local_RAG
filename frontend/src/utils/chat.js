export const getChatId = (chat) => chat?.id || chat?._id;

export function parseMessages(messages) {
  if (!messages) return [];
  if (typeof messages === 'string') {
    try {
      return JSON.parse(messages);
    } catch (error) {
      console.error('Failed to parse JSON messages:', error);
      return [];
    }
  }
  return Array.isArray(messages) ? messages : [];
}
