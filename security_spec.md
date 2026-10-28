# Security Specification

## 1. Data Invariants
- Posts can only be written by authenticated users, and comments must carry the commenter's name or UID.
- Financial transactions should only be modified by authorized treasury/committee roles.
- User profile documents (`/users/{userId}`) can only be written by the respective owner or an admin.
- Upcoming events, blogs, and announcements can only be managed by admins/committee members.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Post**: Create a post with `request.auth == null` -> DENIED
2. **Fake Author UID**: Write a user document with a different UID than `request.auth.uid` -> DENIED
3. **Admin Escalation**: Create a user profile with role 'Admin Utama' as a regular guest user -> DENIED
4. **Unauthorized Financial Edit**: Modify `/kewanganTransactions/123` by a non-committee member -> DENIED
5. **Unauthorized Event Creation**: Write a new document to `/events` by an unauthenticated user -> DENIED
6. **Fake Comment Identity**: Add a comment pretending to be someone else -> DENIED
7. **Bypass Membership Approval**: Set `approvalStatus` to "Diluluskan" as a standard applicant -> DENIED
8. **Malicious Blog Insert**: Write a spam blog post to `/blogs` as a guest -> DENIED
9. **Tamper Fee Collection**: Delete another user's outstanding fee item -> DENIED
10. **Shadow Key Injection**: Write extra fields not present in `/posts` schema -> DENIED
11. **Spam PII Read**: Query all `/users` personal details without an admin role -> DENIED
12. **Audit Log Erasure**: Delete or update a log under `/auditLogs` -> DENIED

## 3. Test Runner
We use `@firebase/rules-unit-testing` to verify that all these malicious payloads are correctly blocked by our Firestore Security Rules.
