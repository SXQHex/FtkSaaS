import { test, expect } from "vitest";
import {
  notificationCopy,
  notificationEmail,
  notificationCatalog,
} from "../src/lib/notification-copy";
test("known native events use the recipient language rather than organization text and unknown languages fall back as a whole", () => {
  expect(notificationCopy("session_change_apply_v1", "session_change_apply_v1", "en")?.title).toBe(
    "Lesson update",
  );
  expect(notificationCopy("reminder", "p05.lesson", "en")?.title).toBe("Lesson reminder");
  expect(
    notificationCopy("session_change_apply_v1", "session_change_apply_v1", "unknown")?.title,
  ).toBe("Ders değişikliği");
  expect(notificationCopy("unknown", "<script>", "en")).toBeNull();
  expect(Object.keys(notificationCatalog.templates)).toHaveLength(12);
});
test("the frontend-owned server template produces bounded plain text without a browser or delivery side effects", () => {
  const email = notificationEmail(
    "collection_record_v1",
    "collection_record_v1",
    "en",
    "Studio\r\nBcc: nobody",
    "https://uye.fethiyetango.com",
  );
  expect(email.subject).toBe("[Studio  Bcc: nobody] Payment update");
  expect(email.text).toBe(
    "View your new notification in the application: https://uye.fethiyetango.com",
  );
  expect(() =>
    notificationEmail(
      "collection_record_v1",
      "collection_record_v1",
      "en",
      "Studio",
      "javascript:alert(1)",
    ),
  ).toThrow("invalidSettings");
});
