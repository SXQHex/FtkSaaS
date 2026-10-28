/* Generated from ../../docs/contracts/08. Do not edit. */

/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Text".
 */
export type Text = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Bool".
 */
export type Bool = boolean
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Int".
 */
export type Int = number
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Count".
 */
export type Count = number
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PositiveInt".
 */
export type PositiveInt = number
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Uuid".
 */
export type Uuid = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Instant".
 */
export type Instant = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Date".
 */
export type Date = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LocalTime".
 */
export type LocalTime = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Secret".
 */
export type Secret = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OpaqueToken".
 */
export type OpaqueToken = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "IanaZone".
 */
export type IanaZone = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Money".
 */
export type Money = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PositiveMoney".
 */
export type PositiveMoney = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Currency".
 */
export type Currency = string
/**
 * Native Supabase access token from a fresh authenticated session. Edge verifies same user; SQL validates session freshness using explicit deployment config. Refreshing an old session is insufficient. Never retained in audit/request context.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReauthProof".
 */
export type ReauthProof = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RateBps".
 */
export type RateBps = number
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RecordState".
 */
export type RecordState = ("active" | "inactive")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OrganizationState".
 */
export type OrganizationState = ("active" | "closed" | "deletion_pending" | "deleted")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountState".
 */
export type AccountState = ("pending" | "active" | "deletion_pending" | "deleted")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LinkState".
 */
export type LinkState = ("active" | "revoked")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "InviteState".
 */
export type InviteState = ("pending" | "accepted" | "expired" | "revoked")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonState".
 */
export type PersonState = ("active" | "merged")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RelationshipState".
 */
export type RelationshipState = ("active" | "inactive")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ApprovalState".
 */
export type ApprovalState = ("pending" | "accepted" | "rejected" | "cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RequestState".
 */
export type RequestState = ("pending" | "alternative_offered" | "approved" | "rejected" | "withdrawn" | "expired")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AlternativeState".
 */
export type AlternativeState = ("offered" | "accepted" | "rejected" | "superseded" | "expired")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReservationState".
 */
export type ReservationState = ("active" | "cancelled" | "completed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionState".
 */
export type SessionState = ("planned" | "occurred" | "cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AttendanceResult".
 */
export type AttendanceResult = ("unmarked" | "attended" | "no_show" | "blocked")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AttendanceClosure".
 */
export type AttendanceClosure = ("open" | "closed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "WaitState".
 */
export type WaitState = ("waiting" | "offered" | "converted" | "left" | "closed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OfferState".
 */
export type OfferState = ("active" | "accepted" | "rejected" | "expired" | "withdrawn")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SaleState".
 */
export type SaleState = ("active" | "terminated" | "expired")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EntitlementState".
 */
export type EntitlementState = ("active" | "suspended" | "closed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AllocationState".
 */
export type AllocationState = ("reserved" | "consumed" | "released")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DeficitState".
 */
export type DeficitState = ("reserved" | "consumed" | "settled" | "released")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FreezeState".
 */
export type FreezeState = ("scheduled" | "active" | "ended" | "cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DebtState".
 */
export type DebtState = ("open" | "settled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LeadState".
 */
export type LeadState = ("open" | "converted" | "closed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "JobState".
 */
export type JobState = ("pending" | "running" | "retry_wait" | "succeeded" | "failed" | "cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SubscriptionState".
 */
export type SubscriptionState = ("pending_payment" | "active" | "grace" | "suspended" | "ended")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ChangeState".
 */
export type ChangeState = ("scheduled" | "applied" | "cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventState".
 */
export type EventState = ("draft" | "published" | "occurred" | "cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventRegistrationState".
 */
export type EventRegistrationState = ("active" | "cancelled" | "completed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FileState".
 */
export type FileState = ("pending_upload" | "ready" | "rejected" | "deleted")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PreviewState".
 */
export type PreviewState = ("current" | "applied" | "invalidated" | "expired")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OperationState".
 */
export type OperationState = ("in_progress" | "succeeded" | "failed_final" | "result_expired")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportRowState".
 */
export type ImportRowState = ("pending" | "valid" | "invalid" | "applied" | "failed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ApplicationState".
 */
export type ApplicationState = ("pending" | "reviewed" | "closed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PrivacyState".
 */
export type PrivacyState = ("requested" | "running" | "partial" | "completed" | "failed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Role".
 */
export type Role = ("owner" | "org_manager" | "center_manager" | "staff" | "instructor" | "assistant" | "student")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RelationshipKind".
 */
export type RelationshipKind = ("student" | "instructor" | "staff" | "candidate")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ResourceKind".
 */
export type ResourceKind = ("room" | "person")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ContactKind".
 */
export type ContactKind = ("email" | "phone")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Duty".
 */
export type Duty = ("instructor" | "assistant")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionFormat".
 */
export type SessionFormat = ("group" | "private")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "BookingMode".
 */
export type BookingMode = ("priority" | "flexible")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EntitlementKind".
 */
export type EntitlementKind = ("credits" | "timed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RefundMethod".
 */
export type RefundMethod = ("none" | "credit_ratio" | "used_at_unit_price" | "time_ratio")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CreditMove".
 */
export type CreditMove = ("grant" | "reserve" | "consume" | "release" | "adjust_add" | "adjust_subtract" | "settle_deficit" | "reverse")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CashMove".
 */
export type CashMove = ("collection" | "refund" | "correction_in" | "correction_out")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "StudentCreditMove".
 */
export type StudentCreditMove = ("surplus_add" | "refund_claim_add" | "offset_subtract" | "refund_subtract" | "reverse" | "correction_subtract")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Direction".
 */
export type Direction = ("increase" | "decrease")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PayModel".
 */
export type PayModel = ("percentage" | "session_fixed" | "per_person" | "fixed_plus_person" | "explicit_mixed")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NotificationChannel".
 */
export type NotificationChannel = ("in_app" | "email")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NotificationPurpose".
 */
export type NotificationPurpose = ("transactional" | "reminder" | "marketing")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CrmActivityKind".
 */
export type CrmActivityKind = ("contact" | "followup" | "outcome")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Plan".
 */
export type Plan = ("starter" | "pro" | "business")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SaasPeriod".
 */
export type SaasPeriod = ("monthly" | "yearly")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FilePurpose".
 */
export type FilePurpose = ("document" | "import" | "export")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PrivacyKind".
 */
export type PrivacyKind = ("account_delete" | "organization_close" | "organization_delete")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RateDimension".
 */
export type RateDimension = ("ip" | "target_org")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ChangeScope".
 */
export type ChangeScope = ("single" | "this_and_future")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ExportFormat".
 */
export type ExportFormat = "csv"
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FollowupKind".
 */
export type FollowupKind = ("renewal_due" | "inactive_student" | "automation_followup")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportKind".
 */
export type ReportKind = ("collections_debts" | "lesson_attendance" | "renewal" | "occupancy" | "resource_usage" | "earnings" | "crm_conversion" | "cross_center_usage")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentGate".
 */
export type DocumentGate = ("sale" | "reservation" | "attendance" | "event_registration")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ApplicationAction".
 */
export type ApplicationAction = ("match_existing" | "create_candidate" | "close")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OrdinaryAttendanceResult".
 */
export type OrdinaryAttendanceResult = ("attended" | "no_show")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "BlockReason".
 */
export type BlockReason = ("credit_limit_exceeded" | "debt_policy")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OperationalRole".
 */
export type OperationalRole = ("staff" | "instructor" | "assistant" | "student")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ConfigurationScopeKind".
 */
export type ConfigurationScopeKind = ("organization" | "center")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CurrencyBasis".
 */
export type CurrencyBasis = ("sale_unit" | "fixed_unit")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Permission".
 */
export type Permission = ("account.self" | "org.read" | "org.manage" | "org.owner" | "center.manage" | "policy.manage" | "person.read" | "person.manage" | "person.activate" | "person.merge" | "invite.student" | "invite.accept" | "schedule.read" | "schedule.manage" | "request.write" | "request.resolve" | "reservation.write" | "attendance.draft" | "attendance.close" | "attendance.correct" | "product.manage" | "sale.write" | "entitlement.correct" | "finance.read" | "finance.collect" | "finance.refund" | "earnings.manage" | "crm.daily" | "crm.manage" | "notification.self" | "report.read" | "report.export" | "import.execute" | "subscription.owner" | "saas.operator" | "event.manage" | "event.register" | "document.manage" | "document.accept" | "public.apply" | "system.worker" | "earnings.read" | "platform.owner" | "center.manager.assign" | "org.configuration" | "auth.recover" | "event.attendance" | "event.close" | "attendance.block" | "reservation.capacity_override")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OperationName".
 */
export type OperationName = ("account_get_v1" | "account_profile_update_v1" | "account_password_change_v1" | "account_password_reset_request_v1" | "account_delete_preview_v1" | "account_delete_apply_v1" | "organizations_list_v1" | "organization_create_v1" | "organization_get_v1" | "organization_update_v1" | "organization_close_preview_v1" | "organization_close_apply_v1" | "organization_reopen_v1" | "organization_delete_preview_v1" | "organization_delete_apply_v1" | "centers_list_v1" | "center_create_v1" | "center_update_v1" | "room_save_v1" | "availability_save_v1" | "availability_exception_save_v1" | "policies_get_v1" | "policy_publish_v1" | "roles_list_v1" | "role_assign_v1" | "role_revoke_v1" | "permission_set_v1" | "org_manager_assign_v1" | "org_manager_revoke_v1" | "manager_self_assign_center_v1" | "account_access_send_v1" | "account_access_revoke_v1" | "account_access_accept_v1" | "account_link_remove_v1" | "people_list_v1" | "person_get_v1" | "person_create_v1" | "person_update_v1" | "student_activate_v1" | "student_deactivate_v1" | "person_merge_preview_v1" | "person_merge_approve_v1" | "person_merge_apply_v1" | "calendar_get_v1" | "class_save_v1" | "program_preview_v1" | "program_apply_v1" | "session_create_v1" | "session_get_v1" | "session_change_preview_v1" | "session_change_apply_v1" | "session_capacity_set_v1" | "session_cancel_preview_v1" | "session_cancel_apply_v1" | "replacement_session_create_v1" | "session_assignment_set_v1" | "lesson_request_create_v1" | "lesson_request_withdraw_v1" | "lesson_request_reject_v1" | "lesson_request_offer_alternative_v1" | "lesson_request_accept_alternative_v1" | "lesson_request_approve_v1" | "reservation_create_v1" | "reservation_cancel_v1" | "reservation_list_v1" | "waitlist_join_v1" | "waitlist_leave_v1" | "seat_offer_accept_v1" | "seat_offer_reject_v1" | "attendance_get_v1" | "attendance_mark_v1" | "attendance_close_v1" | "attendance_correct_preview_v1" | "attendance_correct_apply_v1" | "products_list_v1" | "product_publish_v1" | "sale_preview_v1" | "sale_apply_v1" | "entitlements_get_v1" | "entitlement_extend_v1" | "credit_adjust_v1" | "negative_limit_set_v1" | "freeze_preview_v1" | "freeze_apply_v1" | "freeze_end_preview_v1" | "freeze_end_apply_v1" | "sale_terminate_preview_v1" | "sale_terminate_apply_v1" | "sale_refund_preview_v1" | "sale_refund_apply_v1" | "sale_change_preview_v1" | "sale_change_apply_v1" | "sale_renew_preview_v1" | "sale_renew_apply_v1" | "finance_get_v1" | "collection_record_v1" | "collection_correct_preview_v1" | "collection_correct_apply_v1" | "student_credit_refund_v1" | "student_credit_offset_v1" | "debt_adjust_v1" | "instructor_agreement_publish_v1" | "earnings_list_v1" | "instructor_payment_record_v1" | "instructor_payment_correct_v1" | "leads_list_v1" | "lead_save_v1" | "crm_activity_save_v1" | "trial_offer_create_v1" | "trial_registration_confirm_v1" | "lead_convert_v1" | "crm_followup_list_v1" | "segment_save_v1" | "automation_save_v1" | "notifications_list_v1" | "notification_mark_read_v1" | "notification_preferences_set_v1" | "report_get_v1" | "report_export_start_v1" | "report_file_get_v1" | "import_upload_prepare_v1" | "import_preview_v1" | "import_apply_v1" | "import_rows_list_v1" | "subscription_get_v1" | "subscription_upgrade_quote_v1" | "subscription_downgrade_request_v1" | "subscription_change_cancel_v1" | "subscription_renewal_set_v1" | "saas_payment_submit_v1" | "saas_payment_verify_v1" | "saas_grace_extend_v1" | "event_save_v1" | "event_publish_v1" | "event_register_v1" | "event_registration_cancel_v1" | "event_complete_v1" | "event_duty_verify_v1" | "event_cancel_preview_v1" | "event_cancel_apply_v1" | "event_list_v1" | "document_upload_prepare_v1" | "document_version_publish_v1" | "document_requirements_get_v1" | "document_accept_v1" | "publication_set_v1" | "public_calendar_get_v1" | "public_application_submit_v1" | "public_application_review_v1" | "operation_status_get_v1" | "preview_get_v1" | "job_status_get_v1" | "audit_list_v1" | "seat_offer_issue_v1" | "seat_offer_expire_v1" | "request_expire_v1" | "outbox_deliver_v1" | "reminder_schedule_v1" | "automation_run_v1" | "import_rows_process_v1" | "report_build_v1" | "privacy_execute_v1" | "subscription_boundary_apply_v1" | "class_assignment_set_v1" | "event_attendance_mark_v1" | "platform_owner_set_v1" | "platform_owner_remove_v1" | "center_manager_assign_v1" | "center_manager_revoke_v1" | "attendance_block_v1" | "event_attendance_close_v1" | "event_attendance_correct_v1" | "file_upload_complete_v1" | "negcredit_valuation_set_v1" | "disciplines_list_v1" | "discipline_save_v1" | "center_discipline_set_v1" | "person_discipline_set_v1" | "event_get_v1" | "event_registration_preview_v1" | "event_payment_prepare_v1" | "event_payment_get_v1" | "event_actual_start_record_v1" | "event_actual_start_correct_v1" | "management_state_get_v1" | "instructor_agreements_list_v1" | "reservation_impact_preview_v1" | "reservation_impact_apply_v1" | "settlement_movements_list_v1" | "settlement_requests_list_v1" | "settlement_request_get_v1" | "settlement_request_submit_v1" | "settlement_request_withdraw_v1" | "settlement_request_decide_v1" | "settlement_authority_get_v1" | "settlement_delegation_set_v1" | "settlement_authority_set_v1" | "negative_limits_get_v1" | "attendance_start_v1" | "document_publication_preview_v1" | "settings_catalog_get_v1" | "settings_get_v1" | "settings_update_v1" | "settings_reset_preview_v1" | "settings_reset_apply_v1" | "settings_history_get_v1" | "reservation_capacity_override_v1" | "account_sessions_list_v1" | "account_session_label_v1" | "account_sessions_revoke_v1" | "account_security_history_get_v1" | "account_totp_remove_v1" | "account_google_link_prepare_v1" | "media_get_v1" | "settings_template_resolve_v1" | "calendar_links_get_v1" | "calendar_link_create_v1" | "calendar_link_rotate_v1" | "calendar_link_revoke_v1" | "calendar_feed_get_v1")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EntityType".
 */
export type EntityType = ("organizations" | "centers" | "rooms" | "room_capacities" | "availability_rules" | "availability_exceptions" | "policy_versions" | "accounts" | "account_links" | "role_assignments" | "permission_overrides" | "invitations" | "people" | "person_contacts" | "center_relationships" | "merge_requests" | "merge_approvals" | "classes" | "program_versions" | "sessions" | "session_assignments" | "resource_bookings" | "lesson_requests" | "request_alternatives" | "reservations" | "waitlist_entries" | "seat_offers" | "attendance_entries" | "attendance_closures" | "products" | "product_versions" | "product_scopes" | "sales" | "entitlement_accounts" | "entitlement_movements" | "entitlement_allocations" | "credit_deficits" | "quota_buckets" | "freezes" | "negative_limit_overrides" | "debts" | "cash_movements" | "debt_allocations" | "student_credit_movements" | "debt_adjustments" | "instructor_agreements" | "earnings" | "instructor_payments" | "earning_allocations" | "leads" | "crm_activities" | "trial_offers" | "trial_usages" | "segments" | "automations" | "automation_runs" | "notification_preferences" | "notifications" | "outbox_jobs" | "report_jobs" | "saas_plan_versions" | "saas_subscriptions" | "saas_change_requests" | "saas_quotes" | "saas_payment_verifications" | "events" | "event_assignments" | "event_registrations" | "documents" | "document_versions" | "document_requirements" | "document_acceptances" | "files" | "previews" | "operation_receipts" | "audit_events" | "import_jobs" | "import_rows" | "publications" | "public_applications" | "privacy_requests" | "retention_holds" | "deletion_receipts" | "class_assignments" | "rate_limit_windows" | "disciplines" | "center_disciplines" | "person_disciplines" | "event_disciplines" | "event_payment_preparations")
/**
 * Rows OR; dimensions AND. Same organization; plan/current center access and class/date/capacity gates remain mandatory. No pool per scope. Q-D01: narrow event scope requires exactly one matching label and explicit event eligibility; no event negative credit.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ProductScope".
 */
export type ProductScope = (PackageScopeCenterDiscipline | PackageScopeCenterAllDisciplines | PackageScopeOrganizationDiscipline | PackageScopeOrganizationAll)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PackageScopeCenterDiscipline".
 */
export type PackageScopeCenterDiscipline = {
scope_kind: "center_discipline"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
class_id?: (string | null)
event_id?: (string | null)
/**
 * @minItems 1
 */
usage_targets: [UsageTarget, ...(UsageTarget)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "UsageTarget".
 */
export type UsageTarget = ("lesson" | "event")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PackageScopeCenterAllDisciplines".
 */
export type PackageScopeCenterAllDisciplines = {
scope_kind: "center_all_disciplines"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
discipline_id: null
class_id?: (string | null)
event_id?: (string | null)
/**
 * @minItems 1
 */
usage_targets: [UsageTarget, ...(UsageTarget)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PackageScopeOrganizationDiscipline".
 */
export type PackageScopeOrganizationDiscipline = {
scope_kind: "organization_discipline"
center_id: null
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
class_id?: (string | null)
event_id?: (string | null)
/**
 * @minItems 1
 */
usage_targets: [UsageTarget, ...(UsageTarget)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PackageScopeOrganizationAll".
 */
export type PackageScopeOrganizationAll = {
scope_kind: "organization_all"
center_id: null
discipline_id: null
class_id?: (string | null)
event_id?: (string | null)
/**
 * @minItems 1
 */
usage_targets: [UsageTarget, ...(UsageTarget)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportTarget".
 */
export type ImportTarget = ("display_name" | "email" | "phone" | "source_key" | "person_ref" | "opening_credits" | "opening_debt_minor" | "currency" | "product_version_ref" | "start_date" | "end_date" | "opening_credit_value_minor")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PolicyKey".
 */
export type PolicyKey = ("student_cancel_private" | "student_cancel_group" | "reservation_window" | "request_window" | "negative_default" | "negative_upper" | "debt_booking" | "debt_participation" | "freeze_default" | "waitlist_offer_minutes" | "class_reminder_hours" | "entitlement_reminder_days" | "trial_repeat_limit" | "inactive_student_days" | "participation_block_credit" | "negative_valuation" | "mandatory_document" | "sensitive_money_upper" | "sensitive_credit_upper")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PolicyValue".
 */
export type PolicyValue = (IntegerPolicy | BooleanPolicy | WindowPolicy | CancellationPolicy | BlockCreditPolicy | NegativeValuationPolicy | DocumentPolicy)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DisciplineRelationshipKind".
 */
export type DisciplineRelationshipKind = ("student" | "instructor")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CalendarItem".
 */
export type CalendarItem = {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
type: ("session" | "event")
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
starts_at: Instant
ends_at: Instant
title: Text
resources?: ResourceRef[]
capacity?: (SessionCapacityView | Capacity)
discipline_id?: (string | null)
discipline_ids?: EventDisciplineIds
}
/**
 * Zero/one/many org-owned labels. No entitlement or role grant.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventDisciplineIds".
 *
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
export type EventDisciplineIds = string[]
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "BookingCategory".
 */
export type BookingCategory = ("male" | "female")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManualCollectionPayment".
 */
export type ManualCollectionPayment = {
method: ("cash" | "bank_transfer" | "card_pos")
reference?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EarningDirection".
 */
export type EarningDirection = ("add" | "subtract")
/**
 * Utilization basis points may exceed 10000 when occupancy exceeds nominal capacity.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportRatioBps".
 */
export type ReportRatioBps = number
/**
 * @minItems 1
 * @maxItems 9
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportColumns".
 */
export type ReportColumns = [("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_policy_publish".
 */
export type RequestPolicyPublish = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
key: PolicyKey
value: PolicyValue
effective_at: Instant
mandatory: Bool
impact_approval?: PreviewToken
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids?: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lesson_request_create".
 */
export type RequestLessonRequestCreate = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
requested_start: Instant
duration_minutes: PositiveInt
preferred_instructor_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
window_exception?: boolean
reason?: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lesson_request_offer_alternative".
 */
export type RequestLessonRequestOfferAlternative = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
alternatives: RequestAlternative[]
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
expected_version: PositiveInt
window_exception?: boolean
reason?: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lesson_request_accept_alternative".
 */
export type RequestLessonRequestAcceptAlternative = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
alternative_id: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
window_exception?: boolean
reason?: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_entitlements_get".
 */
export type RequestEntitlementsGet = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
include_timed_rights?: boolean
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
booking_mode?: BookingMode
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_instructor_agreement_publish".
 */
export type RequestInstructorAgreementPublish = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
format: SessionFormat
valid: Interval
terms: PayTerms
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
supersedes_id?: (string | null)
expected_version?: PositiveInt
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_crm_activity_save".
 */
export type RequestCrmActivitySave = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
lead_id?: (string | null)
kind: CrmActivityKind
due_at?: (Instant | null)
outcome?: (Text | null)
note?: (Text | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
activity_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
} & RequestCrmActivitySave1)
export type RequestCrmActivitySave1 = ({
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
} | {
lead_id?: null
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_report_get".
 */
export type RequestReportGet = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
report: ReportKind
filters: ReportFilters
page: Page
columns?: ReportColumns
report_order?: ReportPreparationOrder
group_by?: ReportPreparationGrouping
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportPreparationOrder".
 */
export type ReportPreparationOrder = ("group_key_asc" | "group_key_desc")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportPreparationGrouping".
 */
export type ReportPreparationGrouping = ("person" | "center" | "total")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_report_export_start".
 */
export type RequestReportExportStart = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
report: ReportKind
filters: ReportFilters
format: ExportFormat
columns?: ReportColumns
report_order?: ReportPreparationOrder
group_by?: ReportPreparationGrouping
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_register".
 */
export type RequestEventRegister = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
sale_id?: (string | null)
preview?: (PreviewToken | null)
preparation_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventRegistrationResult".
 */
export type EventRegistrationResult = (EventRegistered | EventCapacityClosed)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonFinancialSnapshot".
 */
export type LessonFinancialSnapshot = {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
name: ("starter" | "pro" | "business")
financial_mode: ("starter_no_earning" | "agreement_earning")
captured_at: Instant
}
/**
 * Exact PostgreSQL numeric intermediate in minor units; never binary floating point.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ExactMinorBasis".
 */
export type ExactMinorBasis = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_product_scopes".
 */
export type TableProductScopes = {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
scope_kind: PackageScopeKind
center_id: (string | null)
discipline_id: (string | null)
class_id?: (string | null)
event_id?: (string | null)
/**
 * @minItems 1
 */
usage_targets: [UsageTarget, ...(UsageTarget)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PackageScopeKind".
 */
export type PackageScopeKind = ("center_discipline" | "center_all_disciplines" | "organization_discipline" | "organization_all")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SignedMoney".
 */
export type SignedMoney = string
/**
 * All UUIDs generated by FtkSaaS must be RFC 9562 UUIDv7. Provider-issued IDs retain their original version.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FtkGeneratedUuidV7".
 */
export type FtkGeneratedUuidV7 = string
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_registration_preview".
 */
export type RequestEventRegistrationPreview = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
sale_id?: (string | null)
preparation_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventPaymentPreparationState".
 */
export type EventPaymentPreparationState = ("prepared" | "registered" | "capacity_closed" | "event_cancelled")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection".
 */
export type ManagementProjection = (ManagementProjectionAccountProfileUpdateV1 | ManagementProjectionAccountDeletePreviewV1 | ManagementProjectionAccountDeleteApplyV1 | ManagementProjectionOrganizationCreateV1 | ManagementProjectionOrganizationUpdateV1 | ManagementProjectionOrganizationClosePreviewV1 | ManagementProjectionOrganizationCloseApplyV1 | ManagementProjectionOrganizationReopenV1 | ManagementProjectionOrganizationDeletePreviewV1 | ManagementProjectionOrganizationDeleteApplyV1 | ManagementProjectionCenterCreateV1 | ManagementProjectionCenterUpdateV1 | ManagementProjectionRoomSaveV1 | ManagementProjectionAvailabilitySaveV1 | ManagementProjectionAvailabilityExceptionSaveV1 | ManagementProjectionPolicyPublishV1 | ManagementProjectionRoleAssignV1 | ManagementProjectionRoleRevokeV1 | ManagementProjectionPermissionSetV1 | ManagementProjectionOrgManagerAssignV1 | ManagementProjectionOrgManagerRevokeV1 | ManagementProjectionManagerSelfAssignCenterV1 | ManagementProjectionAccountAccessSendV1 | ManagementProjectionAccountAccessRevokeV1 | ManagementProjectionAccountAccessAcceptV1 | ManagementProjectionAccountLinkRemoveV1 | ManagementProjectionPersonCreateV1 | ManagementProjectionPersonUpdateV1 | ManagementProjectionStudentActivateV1 | ManagementProjectionStudentDeactivateV1 | ManagementProjectionPersonMergePreviewV1 | ManagementProjectionPersonMergeApproveV1 | ManagementProjectionPersonMergeApplyV1 | ManagementProjectionClassSaveV1 | ManagementProjectionProgramPreviewV1 | ManagementProjectionProgramApplyV1 | ManagementProjectionSessionCreateV1 | ManagementProjectionSessionChangePreviewV1 | ManagementProjectionSessionChangeApplyV1 | ManagementProjectionSessionCapacitySetV1 | ManagementProjectionSessionCancelPreviewV1 | ManagementProjectionSessionCancelApplyV1 | ManagementProjectionReplacementSessionCreateV1 | ManagementProjectionSessionAssignmentSetV1 | ManagementProjectionLessonRequestCreateV1 | ManagementProjectionLessonRequestWithdrawV1 | ManagementProjectionLessonRequestRejectV1 | ManagementProjectionLessonRequestOfferAlternativeV1 | ManagementProjectionLessonRequestAcceptAlternativeV1 | ManagementProjectionLessonRequestApproveV1 | ManagementProjectionReservationCreateV1 | ManagementProjectionReservationCancelV1 | ManagementProjectionWaitlistJoinV1 | ManagementProjectionWaitlistLeaveV1 | ManagementProjectionSeatOfferAcceptV1 | ManagementProjectionSeatOfferRejectV1 | ManagementProjectionAttendanceMarkV1 | ManagementProjectionAttendanceCloseV1 | ManagementProjectionAttendanceCorrectPreviewV1 | ManagementProjectionAttendanceCorrectApplyV1 | ManagementProjectionProductPublishV1 | ManagementProjectionSalePreviewV1 | ManagementProjectionSaleApplyV1 | ManagementProjectionEntitlementExtendV1 | ManagementProjectionCreditAdjustV1 | ManagementProjectionNegativeLimitSetV1 | ManagementProjectionFreezePreviewV1 | ManagementProjectionFreezeApplyV1 | ManagementProjectionFreezeEndPreviewV1 | ManagementProjectionFreezeEndApplyV1 | ManagementProjectionSaleTerminatePreviewV1 | ManagementProjectionSaleTerminateApplyV1 | ManagementProjectionSaleRefundPreviewV1 | ManagementProjectionSaleRefundApplyV1 | ManagementProjectionSaleChangePreviewV1 | ManagementProjectionSaleChangeApplyV1 | ManagementProjectionSaleRenewPreviewV1 | ManagementProjectionSaleRenewApplyV1 | ManagementProjectionCollectionRecordV1 | ManagementProjectionCollectionCorrectPreviewV1 | ManagementProjectionCollectionCorrectApplyV1 | ManagementProjectionStudentCreditRefundV1 | ManagementProjectionStudentCreditOffsetV1 | ManagementProjectionDebtAdjustV1 | ManagementProjectionInstructorAgreementPublishV1 | ManagementProjectionInstructorPaymentRecordV1 | ManagementProjectionInstructorPaymentCorrectV1 | ManagementProjectionLeadSaveV1 | ManagementProjectionCrmActivitySaveV1 | ManagementProjectionTrialOfferCreateV1 | ManagementProjectionTrialRegistrationConfirmV1 | ManagementProjectionLeadConvertV1 | ManagementProjectionSegmentSaveV1 | ManagementProjectionAutomationSaveV1 | ManagementProjectionNotificationMarkReadV1 | ManagementProjectionNotificationPreferencesSetV1 | ManagementProjectionReportExportStartV1 | ManagementProjectionImportUploadPrepareV1 | ManagementProjectionImportPreviewV1 | ManagementProjectionImportApplyV1 | ManagementProjectionSubscriptionUpgradeQuoteV1 | ManagementProjectionSubscriptionDowngradeRequestV1 | ManagementProjectionSubscriptionChangeCancelV1 | ManagementProjectionSubscriptionRenewalSetV1 | ManagementProjectionSaasPaymentSubmitV1 | ManagementProjectionSaasPaymentVerifyV1 | ManagementProjectionSaasGraceExtendV1 | ManagementProjectionEventSaveV1 | ManagementProjectionEventPublishV1 | ManagementProjectionEventRegisterV1 | ManagementProjectionEventRegistrationCancelV1 | ManagementProjectionEventCompleteV1 | ManagementProjectionEventDutyVerifyV1 | ManagementProjectionEventCancelPreviewV1 | ManagementProjectionEventCancelApplyV1 | ManagementProjectionDocumentUploadPrepareV1 | ManagementProjectionDocumentVersionPublishV1 | ManagementProjectionDocumentAcceptV1 | ManagementProjectionPublicationSetV1 | ManagementProjectionPublicApplicationSubmitV1 | ManagementProjectionPublicApplicationReviewV1 | ManagementProjectionClassAssignmentSetV1 | ManagementProjectionEventAttendanceMarkV1 | ManagementProjectionPlatformOwnerSetV1 | ManagementProjectionPlatformOwnerRemoveV1 | ManagementProjectionCenterManagerAssignV1 | ManagementProjectionCenterManagerRevokeV1 | ManagementProjectionAttendanceBlockV1 | ManagementProjectionEventAttendanceCloseV1 | ManagementProjectionEventAttendanceCorrectV1 | ManagementProjectionFileUploadCompleteV1 | ManagementProjectionNegcreditValuationSetV1 | ManagementProjectionDisciplineSaveV1 | ManagementProjectionCenterDisciplineSetV1 | ManagementProjectionPersonDisciplineSetV1 | ManagementProjectionEventRegistrationPreviewV1 | ManagementProjectionEventPaymentPrepareV1 | ManagementProjectionEventActualStartRecordV1 | ManagementProjectionEventActualStartCorrectV1 | ManagementProjectionReservationImpactPreviewV1 | ManagementProjectionReservationImpactApplyV1 | ManagementProjectionSettlementRequestSubmitV1 | ManagementProjectionSettlementRequestWithdrawV1 | ManagementProjectionSettlementRequestDecideV1 | ManagementProjectionSettlementDelegationSetV1 | ManagementProjectionSettlementAuthoritySetV1 | ManagementProjectionAttendanceStartV1 | ManagementProjectionDocumentPublicationPreviewV1 | ManagementProjectionReservationCapacityOverrideV1)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReservationProtectionChange".
 */
export type ReservationProtectionChange = (PolicyProtectionChange | NegativeLimitProtectionChange | CreditProtectionChange | SaleScopeProtectionChange | ValidityProtectionChange)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementProposal".
 */
export type SettlementProposal = (SettlementPaymentProposal | SettlementOffsetProposal | SettlementCorrectionProposal)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Target_policy_publish_protected".
 */
export type TargetPolicyPublishProtected = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
key: PolicyKey
value: PolicyValue
effective_at: Instant
mandatory: Bool
impact_approval: PreviewToken
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementRequestState".
 */
export type SettlementRequestState = ("pending" | "approved" | "rejected" | "withdrawn" | "superseded")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementRequestView".
 */
export type SettlementRequestView = {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
from_center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
to_center_id: string
currency: Currency
state: SettlementRequestState
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
initiator_account_id: string
decision_account_id: (string | null)
reason: (Text | null)
previous_id: (string | null)
proposal: SettlementProposal
record: (SettlementRecordView | null)
initiator_authority: SettlementSubmitAuthority
decision_authority: (SettlementDecisionAuthority | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_management_state_get".
 */
export type RequestManagementStateGet = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
org_id?: (string | null)
center_id?: (string | null)
operation: ManagementOperationName
entity?: (EntityRef | null)
selector: ManagementSelector
page?: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementOperationName".
 */
export type ManagementOperationName = ("account_profile_update_v1" | "account_delete_preview_v1" | "account_delete_apply_v1" | "organization_create_v1" | "organization_update_v1" | "organization_close_preview_v1" | "organization_close_apply_v1" | "organization_reopen_v1" | "organization_delete_preview_v1" | "organization_delete_apply_v1" | "center_create_v1" | "center_update_v1" | "room_save_v1" | "availability_save_v1" | "availability_exception_save_v1" | "policy_publish_v1" | "role_assign_v1" | "role_revoke_v1" | "permission_set_v1" | "org_manager_assign_v1" | "org_manager_revoke_v1" | "manager_self_assign_center_v1" | "account_access_send_v1" | "account_access_revoke_v1" | "account_access_accept_v1" | "account_link_remove_v1" | "person_create_v1" | "person_update_v1" | "student_activate_v1" | "student_deactivate_v1" | "person_merge_preview_v1" | "person_merge_approve_v1" | "person_merge_apply_v1" | "class_save_v1" | "program_preview_v1" | "program_apply_v1" | "session_create_v1" | "session_change_preview_v1" | "session_change_apply_v1" | "session_capacity_set_v1" | "session_cancel_preview_v1" | "session_cancel_apply_v1" | "replacement_session_create_v1" | "session_assignment_set_v1" | "lesson_request_create_v1" | "lesson_request_withdraw_v1" | "lesson_request_reject_v1" | "lesson_request_offer_alternative_v1" | "lesson_request_accept_alternative_v1" | "lesson_request_approve_v1" | "reservation_create_v1" | "reservation_cancel_v1" | "waitlist_join_v1" | "waitlist_leave_v1" | "seat_offer_accept_v1" | "seat_offer_reject_v1" | "attendance_mark_v1" | "attendance_close_v1" | "attendance_correct_preview_v1" | "attendance_correct_apply_v1" | "product_publish_v1" | "sale_preview_v1" | "sale_apply_v1" | "entitlement_extend_v1" | "credit_adjust_v1" | "negative_limit_set_v1" | "freeze_preview_v1" | "freeze_apply_v1" | "freeze_end_preview_v1" | "freeze_end_apply_v1" | "sale_terminate_preview_v1" | "sale_terminate_apply_v1" | "sale_refund_preview_v1" | "sale_refund_apply_v1" | "sale_change_preview_v1" | "sale_change_apply_v1" | "sale_renew_preview_v1" | "sale_renew_apply_v1" | "collection_record_v1" | "collection_correct_preview_v1" | "collection_correct_apply_v1" | "student_credit_refund_v1" | "student_credit_offset_v1" | "debt_adjust_v1" | "instructor_agreement_publish_v1" | "instructor_payment_record_v1" | "instructor_payment_correct_v1" | "lead_save_v1" | "crm_activity_save_v1" | "trial_offer_create_v1" | "trial_registration_confirm_v1" | "lead_convert_v1" | "segment_save_v1" | "automation_save_v1" | "notification_mark_read_v1" | "notification_preferences_set_v1" | "report_export_start_v1" | "import_upload_prepare_v1" | "import_preview_v1" | "import_apply_v1" | "subscription_upgrade_quote_v1" | "subscription_downgrade_request_v1" | "subscription_change_cancel_v1" | "subscription_renewal_set_v1" | "saas_payment_submit_v1" | "saas_payment_verify_v1" | "saas_grace_extend_v1" | "event_save_v1" | "event_publish_v1" | "event_register_v1" | "event_registration_cancel_v1" | "event_complete_v1" | "event_duty_verify_v1" | "event_cancel_preview_v1" | "event_cancel_apply_v1" | "document_upload_prepare_v1" | "document_version_publish_v1" | "document_accept_v1" | "publication_set_v1" | "public_application_submit_v1" | "public_application_review_v1" | "class_assignment_set_v1" | "event_attendance_mark_v1" | "platform_owner_set_v1" | "platform_owner_remove_v1" | "center_manager_assign_v1" | "center_manager_revoke_v1" | "attendance_block_v1" | "event_attendance_close_v1" | "event_attendance_correct_v1" | "file_upload_complete_v1" | "negcredit_valuation_set_v1" | "discipline_save_v1" | "center_discipline_set_v1" | "person_discipline_set_v1" | "event_registration_preview_v1" | "event_payment_prepare_v1" | "event_actual_start_record_v1" | "event_actual_start_correct_v1" | "reservation_impact_preview_v1" | "reservation_impact_apply_v1" | "settlement_request_submit_v1" | "settlement_request_withdraw_v1" | "settlement_request_decide_v1" | "settlement_delegation_set_v1" | "settlement_authority_set_v1" | "attendance_start_v1" | "document_publication_preview_v1" | "settings_update_v1" | "settings_reset_preview_v1" | "settings_reset_apply_v1" | "reservation_capacity_override_v1")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector".
 */
export type ManagementSelector = (ManagementSelectorAccountProfileUpdateV1 | ManagementSelectorAccountDeletePreviewV1 | ManagementSelectorAccountDeleteApplyV1 | ManagementSelectorOrganizationCreateV1 | ManagementSelectorOrganizationUpdateV1 | ManagementSelectorOrganizationClosePreviewV1 | ManagementSelectorOrganizationCloseApplyV1 | ManagementSelectorOrganizationReopenV1 | ManagementSelectorOrganizationDeletePreviewV1 | ManagementSelectorOrganizationDeleteApplyV1 | ManagementSelectorCenterCreateV1 | ManagementSelectorCenterUpdateV1 | ManagementSelectorRoomSaveV1 | ManagementSelectorAvailabilitySaveV1 | ManagementSelectorAvailabilityExceptionSaveV1 | ManagementSelectorPolicyPublishV1 | ManagementSelectorRoleAssignV1 | ManagementSelectorRoleRevokeV1 | ManagementSelectorPermissionSetV1 | ManagementSelectorOrgManagerAssignV1 | ManagementSelectorOrgManagerRevokeV1 | ManagementSelectorManagerSelfAssignCenterV1 | ManagementSelectorAccountAccessSendV1 | ManagementSelectorAccountAccessRevokeV1 | ManagementSelectorAccountAccessAcceptV1 | ManagementSelectorAccountLinkRemoveV1 | ManagementSelectorPersonCreateV1 | ManagementSelectorPersonUpdateV1 | ManagementSelectorStudentActivateV1 | ManagementSelectorStudentDeactivateV1 | ManagementSelectorPersonMergePreviewV1 | ManagementSelectorPersonMergeApproveV1 | ManagementSelectorPersonMergeApplyV1 | ManagementSelectorClassSaveV1 | ManagementSelectorProgramPreviewV1 | ManagementSelectorProgramApplyV1 | ManagementSelectorSessionCreateV1 | ManagementSelectorSessionChangePreviewV1 | ManagementSelectorSessionChangeApplyV1 | ManagementSelectorSessionCapacitySetV1 | ManagementSelectorSessionCancelPreviewV1 | ManagementSelectorSessionCancelApplyV1 | ManagementSelectorReplacementSessionCreateV1 | ManagementSelectorSessionAssignmentSetV1 | ManagementSelectorLessonRequestCreateV1 | ManagementSelectorLessonRequestWithdrawV1 | ManagementSelectorLessonRequestRejectV1 | ManagementSelectorLessonRequestOfferAlternativeV1 | ManagementSelectorLessonRequestAcceptAlternativeV1 | ManagementSelectorLessonRequestApproveV1 | ManagementSelectorReservationCreateV1 | ManagementSelectorReservationCancelV1 | ManagementSelectorWaitlistJoinV1 | ManagementSelectorWaitlistLeaveV1 | ManagementSelectorSeatOfferAcceptV1 | ManagementSelectorSeatOfferRejectV1 | ManagementSelectorAttendanceMarkV1 | ManagementSelectorAttendanceCloseV1 | ManagementSelectorAttendanceCorrectPreviewV1 | ManagementSelectorAttendanceCorrectApplyV1 | ManagementSelectorProductPublishV1 | ManagementSelectorSalePreviewV1 | ManagementSelectorSaleApplyV1 | ManagementSelectorEntitlementExtendV1 | ManagementSelectorCreditAdjustV1 | ManagementSelectorNegativeLimitSetV1 | ManagementSelectorFreezePreviewV1 | ManagementSelectorFreezeApplyV1 | ManagementSelectorFreezeEndPreviewV1 | ManagementSelectorFreezeEndApplyV1 | ManagementSelectorSaleTerminatePreviewV1 | ManagementSelectorSaleTerminateApplyV1 | ManagementSelectorSaleRefundPreviewV1 | ManagementSelectorSaleRefundApplyV1 | ManagementSelectorSaleChangePreviewV1 | ManagementSelectorSaleChangeApplyV1 | ManagementSelectorSaleRenewPreviewV1 | ManagementSelectorSaleRenewApplyV1 | ManagementSelectorCollectionRecordV1 | ManagementSelectorCollectionCorrectPreviewV1 | ManagementSelectorCollectionCorrectApplyV1 | ManagementSelectorStudentCreditRefundV1 | ManagementSelectorStudentCreditOffsetV1 | ManagementSelectorDebtAdjustV1 | ManagementSelectorInstructorAgreementPublishV1 | ManagementSelectorInstructorPaymentRecordV1 | ManagementSelectorInstructorPaymentCorrectV1 | ManagementSelectorLeadSaveV1 | ManagementSelectorCrmActivitySaveV1 | ManagementSelectorTrialOfferCreateV1 | ManagementSelectorTrialRegistrationConfirmV1 | ManagementSelectorLeadConvertV1 | ManagementSelectorSegmentSaveV1 | ManagementSelectorAutomationSaveV1 | ManagementSelectorNotificationMarkReadV1 | ManagementSelectorNotificationPreferencesSetV1 | ManagementSelectorReportExportStartV1 | ManagementSelectorImportUploadPrepareV1 | ManagementSelectorImportPreviewV1 | ManagementSelectorImportApplyV1 | ManagementSelectorSubscriptionUpgradeQuoteV1 | ManagementSelectorSubscriptionDowngradeRequestV1 | ManagementSelectorSubscriptionChangeCancelV1 | ManagementSelectorSubscriptionRenewalSetV1 | ManagementSelectorSaasPaymentSubmitV1 | ManagementSelectorSaasPaymentVerifyV1 | ManagementSelectorSaasGraceExtendV1 | ManagementSelectorEventSaveV1 | ManagementSelectorEventPublishV1 | ManagementSelectorEventRegisterV1 | ManagementSelectorEventRegistrationCancelV1 | ManagementSelectorEventCompleteV1 | ManagementSelectorEventDutyVerifyV1 | ManagementSelectorEventCancelPreviewV1 | ManagementSelectorEventCancelApplyV1 | ManagementSelectorDocumentUploadPrepareV1 | ManagementSelectorDocumentVersionPublishV1 | ManagementSelectorDocumentAcceptV1 | ManagementSelectorPublicationSetV1 | ManagementSelectorPublicApplicationSubmitV1 | ManagementSelectorPublicApplicationReviewV1 | ManagementSelectorClassAssignmentSetV1 | ManagementSelectorEventAttendanceMarkV1 | ManagementSelectorPlatformOwnerSetV1 | ManagementSelectorPlatformOwnerRemoveV1 | ManagementSelectorCenterManagerAssignV1 | ManagementSelectorCenterManagerRevokeV1 | ManagementSelectorAttendanceBlockV1 | ManagementSelectorEventAttendanceCloseV1 | ManagementSelectorEventAttendanceCorrectV1 | ManagementSelectorFileUploadCompleteV1 | ManagementSelectorNegcreditValuationSetV1 | ManagementSelectorDisciplineSaveV1 | ManagementSelectorCenterDisciplineSetV1 | ManagementSelectorPersonDisciplineSetV1 | ManagementSelectorEventRegistrationPreviewV1 | ManagementSelectorEventPaymentPrepareV1 | ManagementSelectorEventActualStartRecordV1 | ManagementSelectorEventActualStartCorrectV1 | ManagementSelectorReservationImpactPreviewV1 | ManagementSelectorReservationImpactApplyV1 | ManagementSelectorSettlementRequestSubmitV1 | ManagementSelectorSettlementRequestWithdrawV1 | ManagementSelectorSettlementRequestDecideV1 | ManagementSelectorSettlementDelegationSetV1 | ManagementSelectorSettlementAuthoritySetV1 | ManagementSelectorAttendanceStartV1 | ManagementSelectorDocumentPublicationPreviewV1 | ManagementSelectorSettingsUpdateV1 | ManagementSelectorSettingsResetPreviewV1 | ManagementSelectorSettingsResetApplyV1 | ManagementSelectorReservationCapacityOverrideV1)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsScope".
 */
export type SettingsScope = ("user" | "member" | "center" | "organization" | "platform")
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_request_submit".
 */
export type RequestSettlementRequestSubmit = {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
from_center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
to_center_id: string
currency: Currency
reason: Text
previous_id?: (string | null)
previous_version?: PositiveInt
proposal: SettlementProposal
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsVersion".
 */
export type SettingsVersion = number
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsView".
 */
export type SettingsView = ({
scope: SettingsScope
version: SettingsVersion
values: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
as_of: Instant
/**
 * @maxItems 50
 */
overridden_fields: ("ad_measurement" | "ad_personalization" | "address" | "application_name" | "billing_address" | "billing_email" | "billing_name" | "calendar_view" | "contact_email" | "contact_phone" | "contrast" | "date_format" | "description" | "email_visible" | "font_package_id" | "font_scale" | "history_recommendations" | "honorific" | "in_app_marketing" | "in_app_reminders" | "interest_center_ids" | "interest_discipline_ids" | "language" | "maintenance_message" | "marketing_in_app" | "motion" | "number_format" | "optional_analytics" | "phone_visible" | "photo_visible" | "profile_visible" | "program_duration_minutes" | "remember_context" | "show_weekends" | "startup_context" | "support_email" | "support_url" | "theme" | "theme_package_id" | "time_format" | "timezone_mode" | "timezone_name" | "week_start" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours")[]
program_duration_source?: {
kind: ("system_default" | "organization_copy" | "center_local")
organization_version?: SettingsVersion
}
logo?: (SettingsMediaAsset | null)
} & SettingsView1)
export type SettingsView1 = ({
scope: "user"
version: SettingsVersion
values: UserSettingsValues
as_of: Instant
/**
 * @maxItems 50
 */
overridden_fields: ("honorific" | "language" | "date_format" | "time_format" | "number_format" | "week_start" | "timezone_mode" | "theme" | "contrast" | "motion" | "remember_context" | "calendar_view" | "show_weekends" | "marketing_in_app" | "ad_personalization" | "ad_measurement" | "optional_analytics" | "timezone_name" | "font_scale" | "startup_context")[]
} | {
scope: "member"
version: SettingsVersion
values: MemberSettingsValues
as_of: Instant
/**
 * @maxItems 50
 */
overridden_fields: ("profile_visible" | "photo_visible" | "email_visible" | "phone_visible" | "history_recommendations" | "interest_center_ids" | "interest_discipline_ids" | "in_app_reminders" | "in_app_marketing" | "report_templates" | "import_templates")[]
} | {
scope: "center"
version: SettingsVersion
values: CenterSettingsValues
as_of: Instant
/**
 * @maxItems 50
 */
overridden_fields: ("description" | "address" | "contact_phone" | "contact_email" | "program_duration_minutes" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours")[]
program_duration_source?: {
kind: ("system_default" | "organization_copy" | "center_local")
organization_version?: SettingsVersion
}
} | {
scope: "organization"
version: SettingsVersion
values: OrganizationSettingsValues
as_of: Instant
/**
 * @maxItems 50
 */
overridden_fields: ("description" | "address" | "contact_phone" | "contact_email" | "theme_package_id" | "font_package_id" | "billing_name" | "billing_address" | "billing_email" | "program_duration_minutes" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours")[]
logo?: (SettingsMediaAsset | null)
} | {
scope: "platform"
version: SettingsVersion
values: PlatformSettingsValues
as_of: Instant
/**
 * @maxItems 50
 */
overridden_fields: ("application_name" | "support_email" | "support_url" | "maintenance_message")[]
})
/**
 * @minItems 1
 * @maxItems 50
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsFieldKeys".
 */
export type SettingsFieldKeys = [("ad_measurement" | "ad_personalization" | "address" | "application_name" | "billing_address" | "billing_email" | "billing_name" | "calendar_view" | "contact_email" | "contact_phone" | "contrast" | "date_format" | "description" | "email_visible" | "font_package_id" | "font_scale" | "history_recommendations" | "honorific" | "in_app_marketing" | "in_app_reminders" | "interest_center_ids" | "interest_discipline_ids" | "language" | "maintenance_message" | "marketing_in_app" | "motion" | "number_format" | "optional_analytics" | "phone_visible" | "photo_visible" | "profile_visible" | "program_duration_minutes" | "remember_context" | "show_weekends" | "startup_context" | "support_email" | "support_url" | "theme" | "theme_package_id" | "time_format" | "timezone_mode" | "timezone_name" | "week_start" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours"), ...(("ad_measurement" | "ad_personalization" | "address" | "application_name" | "billing_address" | "billing_email" | "billing_name" | "calendar_view" | "contact_email" | "contact_phone" | "contrast" | "date_format" | "description" | "email_visible" | "font_package_id" | "font_scale" | "history_recommendations" | "honorific" | "in_app_marketing" | "in_app_reminders" | "interest_center_ids" | "interest_discipline_ids" | "language" | "maintenance_message" | "marketing_in_app" | "motion" | "number_format" | "optional_analytics" | "phone_visible" | "photo_visible" | "profile_visible" | "program_duration_minutes" | "remember_context" | "show_weekends" | "startup_context" | "support_email" | "support_url" | "theme" | "theme_package_id" | "time_format" | "timezone_mode" | "timezone_name" | "week_start" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours"))[]]
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsCatalog".
 */
export type SettingsCatalog = ({
scope: SettingsScope
catalog_version: 5
fields: SettingsFieldDescriptor[]
defaults: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
/**
 * @maxItems 0
 */
brand_packages: []
limitations: string[]
work_templates?: WorkTemplates
} & SettingsCatalog1)
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "WorkTemplateReference".
 */
export type WorkTemplateReference = ({
scope: ("member" | "center" | "organization")
key: string
version: SettingsVersion
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
} & WorkTemplateReference1)
export type WorkTemplateReference1 = ({
scope: "member"
key: string
version: SettingsVersion
} | {
scope: "center"
key: string
version: SettingsVersion
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
} | {
scope: "organization"
key: string
version: SettingsVersion
})
export type SettingsCatalog1 = ({
scope: "user"
catalog_version: 5
fields: SettingsFieldDescriptor[]
defaults: UserSettingsValues
/**
 * @maxItems 0
 */
brand_packages: []
limitations: string[]
work_templates?: WorkTemplates
} | {
scope: "member"
catalog_version: 5
fields: SettingsFieldDescriptor[]
defaults: MemberSettingsValues
/**
 * @maxItems 0
 */
brand_packages: []
limitations: string[]
work_templates?: WorkTemplates
} | {
scope: "center"
catalog_version: 5
fields: SettingsFieldDescriptor[]
defaults: CenterSettingsValues
/**
 * @maxItems 0
 */
brand_packages: []
limitations: string[]
work_templates?: WorkTemplates
} | {
scope: "organization"
catalog_version: 5
fields: SettingsFieldDescriptor[]
defaults: OrganizationSettingsValues
/**
 * @maxItems 0
 */
brand_packages: []
limitations: string[]
work_templates?: WorkTemplates
} | {
scope: "platform"
catalog_version: 5
fields: SettingsFieldDescriptor[]
defaults: PlatformSettingsValues
/**
 * @maxItems 0
 */
brand_packages: []
limitations: string[]
work_templates?: WorkTemplates
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_catalog_get".
 */
export type RequestSettingsCatalogGet = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: SettingsScope
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
template_center_id?: string
} & RequestSettingsCatalogGet1)
export type RequestSettingsCatalogGet1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "member"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
template_center_id?: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "center"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "platform"
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_get".
 */
export type RequestSettingsGet = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: SettingsScope
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
} & RequestSettingsGet1)
export type RequestSettingsGet1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "member"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "center"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "platform"
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_update".
 */
export type RequestSettingsUpdate = (RequestSettingsUpdate1 & {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: SettingsScope
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
patch: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
logo_image?: (SettingsImageUpload | null)
} & RequestSettingsUpdate2)
export type RequestSettingsUpdate1 = ({
patch?: {
[k: string]: unknown
}
} | {
[k: string]: unknown
})
export type RequestSettingsUpdate2 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
patch: UserSettingsValues
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "member"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
patch: MemberSettingsValues
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "center"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
patch: CenterSettingsValues
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
patch: OrganizationSettingsValues
logo_image?: (SettingsImageUpload | null)
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "platform"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
patch: PlatformSettingsValues
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_reset_preview".
 */
export type RequestSettingsResetPreview = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: SettingsScope
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
fields: SettingsFieldKeys
} & RequestSettingsResetPreview1)
export type RequestSettingsResetPreview1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
/**
 * @minItems 1
 * @maxItems 50
 */
fields: [("honorific" | "language" | "date_format" | "time_format" | "number_format" | "week_start" | "timezone_mode" | "theme" | "contrast" | "motion" | "remember_context" | "calendar_view" | "show_weekends" | "marketing_in_app" | "ad_personalization" | "ad_measurement" | "optional_analytics" | "timezone_name" | "font_scale" | "startup_context"), ...(("honorific" | "language" | "date_format" | "time_format" | "number_format" | "week_start" | "timezone_mode" | "theme" | "contrast" | "motion" | "remember_context" | "calendar_view" | "show_weekends" | "marketing_in_app" | "ad_personalization" | "ad_measurement" | "optional_analytics" | "timezone_name" | "font_scale" | "startup_context"))[]]
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "member"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * @minItems 1
 * @maxItems 50
 */
fields: [("profile_visible" | "photo_visible" | "email_visible" | "phone_visible" | "history_recommendations" | "interest_center_ids" | "interest_discipline_ids" | "in_app_reminders" | "in_app_marketing" | "report_templates" | "import_templates"), ...(("profile_visible" | "photo_visible" | "email_visible" | "phone_visible" | "history_recommendations" | "interest_center_ids" | "interest_discipline_ids" | "in_app_reminders" | "in_app_marketing" | "report_templates" | "import_templates"))[]]
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "center"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * @minItems 1
 * @maxItems 50
 */
fields: [("description" | "address" | "contact_phone" | "contact_email" | "program_duration_minutes" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours"), ...(("description" | "address" | "contact_phone" | "contact_email" | "program_duration_minutes" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours"))[]]
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * @minItems 1
 * @maxItems 50
 */
fields: [("description" | "address" | "contact_phone" | "contact_email" | "theme_package_id" | "font_package_id" | "billing_name" | "billing_address" | "billing_email" | "program_duration_minutes" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours"), ...(("description" | "address" | "contact_phone" | "contact_email" | "theme_package_id" | "font_package_id" | "billing_name" | "billing_address" | "billing_email" | "program_duration_minutes" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours"))[]]
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "platform"
/**
 * @minItems 1
 * @maxItems 50
 */
fields: [("application_name" | "support_email" | "support_url" | "maintenance_message"), ...(("application_name" | "support_email" | "support_url" | "maintenance_message"))[]]
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_reset_apply".
 */
export type RequestSettingsResetApply = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: SettingsScope
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
preview: PreviewToken
} & RequestSettingsResetApply1)
export type RequestSettingsResetApply1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
preview: PreviewToken
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "member"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
preview: PreviewToken
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "center"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
preview: PreviewToken
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
preview: PreviewToken
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "platform"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: SettingsVersion
reason?: string
preview: PreviewToken
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_history_get".
 */
export type RequestSettingsHistoryGet = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: SettingsScope
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
cursor?: string
} & RequestSettingsHistoryGet1)
export type RequestSettingsHistoryGet1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
cursor?: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "member"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
cursor?: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "center"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
cursor?: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
cursor?: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "platform"
cursor?: string
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_sessions_revoke".
 */
export type RequestAccountSessionsRevoke = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
mode: ("selected" | "current" | "others")
/**
 * Provider-owned UUID; preserve version and value.
 */
session_id?: string
reauth?: ReauthProof
} & RequestAccountSessionsRevoke1)
export type RequestAccountSessionsRevoke1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
mode: "selected"
/**
 * Provider-owned UUID; preserve version and value.
 */
session_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
mode: "current"
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
mode: "others"
reauth: ReauthProof
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_media_get".
 */
export type RequestMediaGet = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: ("user" | "organization" | "lesson_participant")
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
asset_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
} & RequestMediaGet1)
export type RequestMediaGet1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "user"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
asset_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "organization"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
asset_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
scope: "lesson_participant"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
asset_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settings_template_resolve".
 */
export type RequestSettingsTemplateResolve = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
kind: ("report" | "import")
template: WorkTemplateReference
overrides?: (ReportTemplateOverrides | ImportTemplateOverrides)
} & RequestSettingsTemplateResolve1)
export type RequestSettingsTemplateResolve1 = ({
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
kind: "report"
template: WorkTemplateReference
overrides?: ReportTemplateOverrides
} | {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
kind: "import"
template: WorkTemplateReference
overrides?: ImportTemplateOverrides
})
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ResolvedWorkTemplate".
 */
export type ResolvedWorkTemplate = ({
kind: "report"
source: WorkTemplateReference
request: PreparedReportRequest
} | {
kind: "import"
source: WorkTemplateReference
request: PreparedImportRequest
})
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FtkUuid".
 */
export type FtkUuid = string
/**
 * Provider-owned UUID; preserve version and value.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ProviderUuid".
 */
export type ProviderUuid = string

export interface FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments {
Text?: Text
Bool?: Bool
Int?: Int
Count?: Count
PositiveInt?: PositiveInt
Uuid?: Uuid
Instant?: Instant
Date?: Date
LocalTime?: LocalTime
Secret?: Secret
OpaqueToken?: OpaqueToken
IanaZone?: IanaZone
Money?: Money
PositiveMoney?: PositiveMoney
Currency?: Currency
ReauthProof?: ReauthProof
RateBps?: RateBps
RecordState?: RecordState
OrganizationState?: OrganizationState
AccountState?: AccountState
LinkState?: LinkState
InviteState?: InviteState
PersonState?: PersonState
RelationshipState?: RelationshipState
ApprovalState?: ApprovalState
RequestState?: RequestState
AlternativeState?: AlternativeState
ReservationState?: ReservationState
SessionState?: SessionState
AttendanceResult?: AttendanceResult
AttendanceClosure?: AttendanceClosure
WaitState?: WaitState
OfferState?: OfferState
SaleState?: SaleState
EntitlementState?: EntitlementState
AllocationState?: AllocationState
DeficitState?: DeficitState
FreezeState?: FreezeState
DebtState?: DebtState
LeadState?: LeadState
JobState?: JobState
SubscriptionState?: SubscriptionState
ChangeState?: ChangeState
EventState?: EventState
EventRegistrationState?: EventRegistrationState
FileState?: FileState
PreviewState?: PreviewState
OperationState?: OperationState
ImportRowState?: ImportRowState
ApplicationState?: ApplicationState
PrivacyState?: PrivacyState
Role?: Role
RelationshipKind?: RelationshipKind
ResourceKind?: ResourceKind
ContactKind?: ContactKind
Duty?: Duty
SessionFormat?: SessionFormat
BookingMode?: BookingMode
EntitlementKind?: EntitlementKind
RefundMethod?: RefundMethod
CreditMove?: CreditMove
CashMove?: CashMove
StudentCreditMove?: StudentCreditMove
Direction?: Direction
PayModel?: PayModel
NotificationChannel?: NotificationChannel
NotificationPurpose?: NotificationPurpose
CrmActivityKind?: CrmActivityKind
Plan?: Plan
SaasPeriod?: SaasPeriod
FilePurpose?: FilePurpose
PrivacyKind?: PrivacyKind
RateDimension?: RateDimension
ChangeScope?: ChangeScope
ExportFormat?: ExportFormat
FollowupKind?: FollowupKind
ReportKind?: ReportKind
DocumentGate?: DocumentGate
ApplicationAction?: ApplicationAction
OrdinaryAttendanceResult?: OrdinaryAttendanceResult
BlockReason?: BlockReason
OperationalRole?: OperationalRole
ConfigurationScopeKind?: ConfigurationScopeKind
CurrencyBasis?: CurrencyBasis
Permission?: Permission
OperationName?: OperationName
EntityType?: EntityType
Interval?: Interval
DateInterval?: DateInterval
Capacity?: Capacity
ConfigurationScope?: ConfigurationScope
RoleScope?: RoleScope
RoomCapacity?: RoomCapacity
CenterCreate?: CenterCreate
ContactInput?: ContactInput
PersonPatch?: PersonPatch
ResourceRef?: ResourceRef
AvailabilityRule?: AvailabilityRule
DutyInput?: DutyInput
ProgramSpec?: ProgramSpec
SessionCreate?: SessionCreate
SessionPatch?: SessionPatch
RequestAlternative?: RequestAlternative
SubjectRef?: SubjectRef
EntityRef?: EntityRef
EntityVersion?: EntityVersion
PreviewToken?: PreviewToken
CashCorrection?: CashCorrection
AttendanceCorrection?: AttendanceCorrection
QuotaSpec?: QuotaSpec
FreezeTerms?: FreezeTerms
RefundTerms?: RefundTerms
ProductScope?: ProductScope
ProductTerms?: ProductTerms
ValuationBasis?: ValuationBasis
PayComponent?: PayComponent
RoomFee?: RoomFee
PayTerms?: PayTerms
VenueSpec?: VenueSpec
EventDutyInput?: EventDutyInput
CancellationTerms?: CancellationTerms
EventTerms?: EventTerms
DocumentRequirement?: DocumentRequirement
DocumentScope?: DocumentScope
AcceptanceContext?: AcceptanceContext
SegmentCondition?: SegmentCondition
SegmentDefinition?: SegmentDefinition
AutomationTrigger?: AutomationTrigger
AutomationAction?: AutomationAction
AutomationDefinition?: AutomationDefinition
ImportTarget?: ImportTarget
ImportColumn?: ImportColumn
ImportMapping?: ImportMapping
ImportRow?: ImportRow
ReportFilters?: ReportFilters
Page?: Page
PolicyKey?: PolicyKey
IntegerPolicy?: IntegerPolicy
BooleanPolicy?: BooleanPolicy
WindowPolicy?: WindowPolicy
CancellationPolicy?: CancellationPolicy
BlockCreditPolicy?: BlockCreditPolicy
NegativeValuationPolicy?: NegativeValuationPolicy
DocumentPolicy?: DocumentPolicy
PolicyValue?: PolicyValue
PolicyVersionInput?: PolicyVersionInput
SafeError?: SafeError
Effect?: Effect
PreviewDependencies?: PreviewDependencies
PreviewResult?: PreviewResult
Preview?: Preview
Mutation?: Mutation
JobRef?: JobRef
DownloadRef?: DownloadRef
UploadRef?: UploadRef
GenericAccepted?: GenericAccepted
WorkerResult?: WorkerResult
ContactView?: ContactView
AccountView?: AccountView
OrganizationView?: OrganizationView
CenterView?: CenterView
RoleView?: RoleView
PolicyView?: PolicyView
RelationshipView?: RelationshipView
PersonSummary?: PersonSummary
PersonView?: PersonView
CalendarItem?: CalendarItem
SessionView?: SessionView
ReservationView?: ReservationView
AttendanceEntryView?: AttendanceEntryView
AttendanceView?: AttendanceView
ProductView?: ProductView
QuotaView?: QuotaView
EntitlementView?: EntitlementView
DebtSummary?: DebtSummary
CashSummary?: CashSummary
FinanceView?: FinanceView
EarningBasis?: EarningBasis
EarningView?: EarningView
LeadView?: LeadView
NotificationPayload?: NotificationPayload
NotificationView?: NotificationView
ReportRow?: ReportRow
ReportTotal?: ReportTotal
ReportView?: ReportView
ImportRowView?: ImportRowView
QuoteView?: QuoteView
PlanLimit?: PlanLimit
PlanLimits?: PlanLimits
SubscriptionView?: SubscriptionView
EventView?: EventView
DocumentView?: DocumentView
PublicCalendarItem?: PublicCalendarItem
OperationStatusView?: OperationStatusView
JobStatusView?: JobStatusView
AuditFieldChange?: AuditFieldChange
AuditDiff?: AuditDiff
AuditView?: AuditView
PrivacyScope?: PrivacyScope
EligibilitySnapshot?: EligibilitySnapshot
OperationResult?: OperationResult
AuthResult?: AuthResult
SupabaseAuthPasswordRequest?: SupabaseAuthPasswordRequest
Page_AccountView?: Page_AccountView
Page_OrganizationView?: Page_OrganizationView
Page_CenterView?: Page_CenterView
Page_RoleView?: Page_RoleView
Page_PolicyView?: Page_PolicyView
Page_PersonSummary?: Page_PersonSummary
Page_PersonView?: Page_PersonView
Page_CalendarItem?: Page_CalendarItem
Page_SessionView?: Page_SessionView
Page_ReservationView?: Page_ReservationView
Page_AttendanceView?: Page_AttendanceView
Page_ProductView?: Page_ProductView
Page_EntitlementView?: Page_EntitlementView
Page_FinanceView?: Page_FinanceView
Page_EarningView?: Page_EarningView
Page_LeadView?: Page_LeadView
Page_NotificationView?: Page_NotificationView
Page_ReportView?: Page_ReportView
Page_ImportRowView?: Page_ImportRowView
Page_QuoteView?: Page_QuoteView
Page_SubscriptionView?: Page_SubscriptionView
Page_EventView?: Page_EventView
Page_DocumentView?: Page_DocumentView
Page_PublicCalendarItem?: Page_PublicCalendarItem
Page_OperationStatusView?: Page_OperationStatusView
Page_JobStatusView?: Page_JobStatusView
Page_AuditView?: Page_AuditView
Page_CashSummary?: Page_CashSummary
Page_ReportRow?: Page_ReportRow
Request_account_get?: RequestAccountGet
Success_account_get?: SuccessAccountGet
Request_account_profile_update?: RequestAccountProfileUpdate
Success_account_profile_update?: SuccessAccountProfileUpdate
Request_account_password_change?: RequestAccountPasswordChange
Success_account_password_change?: SuccessAccountPasswordChange
Request_account_password_reset_request?: RequestAccountPasswordResetRequest
Success_account_password_reset_request?: SuccessAccountPasswordResetRequest
Request_account_delete_preview?: RequestAccountDeletePreview
Success_account_delete_preview?: SuccessAccountDeletePreview
Request_account_delete_apply?: RequestAccountDeleteApply
Success_account_delete_apply?: SuccessAccountDeleteApply
Request_organizations_list?: RequestOrganizationsList
Success_organizations_list?: SuccessOrganizationsList
Request_organization_create?: RequestOrganizationCreate
Success_organization_create?: SuccessOrganizationCreate
Request_organization_get?: RequestOrganizationGet
Success_organization_get?: SuccessOrganizationGet
Request_organization_update?: RequestOrganizationUpdate
Success_organization_update?: SuccessOrganizationUpdate
Request_organization_close_preview?: RequestOrganizationClosePreview
Success_organization_close_preview?: SuccessOrganizationClosePreview
Request_organization_close_apply?: RequestOrganizationCloseApply
Success_organization_close_apply?: SuccessOrganizationCloseApply
Request_organization_reopen?: RequestOrganizationReopen
Success_organization_reopen?: SuccessOrganizationReopen
Request_organization_delete_preview?: RequestOrganizationDeletePreview
Success_organization_delete_preview?: SuccessOrganizationDeletePreview
Request_organization_delete_apply?: RequestOrganizationDeleteApply
Success_organization_delete_apply?: SuccessOrganizationDeleteApply
Request_centers_list?: RequestCentersList
Success_centers_list?: SuccessCentersList
Request_center_create?: RequestCenterCreate
Success_center_create?: SuccessCenterCreate
Request_center_update?: RequestCenterUpdate
Success_center_update?: SuccessCenterUpdate
Request_room_save?: RequestRoomSave
Success_room_save?: SuccessRoomSave
Request_availability_save?: RequestAvailabilitySave
Success_availability_save?: SuccessAvailabilitySave
Request_availability_exception_save?: RequestAvailabilityExceptionSave
Success_availability_exception_save?: SuccessAvailabilityExceptionSave
Request_policies_get?: RequestPoliciesGet
Success_policies_get?: SuccessPoliciesGet
Request_policy_publish?: RequestPolicyPublish
Success_policy_publish?: SuccessPolicyPublish
Request_roles_list?: RequestRolesList
Success_roles_list?: SuccessRolesList
Request_role_assign?: RequestRoleAssign
Success_role_assign?: SuccessRoleAssign
Request_role_revoke?: RequestRoleRevoke
Success_role_revoke?: SuccessRoleRevoke
Request_permission_set?: RequestPermissionSet
Success_permission_set?: SuccessPermissionSet
Request_org_manager_assign?: RequestOrgManagerAssign
Success_org_manager_assign?: SuccessOrgManagerAssign
Request_org_manager_revoke?: RequestOrgManagerRevoke
Success_org_manager_revoke?: SuccessOrgManagerRevoke
Request_manager_self_assign_center?: RequestManagerSelfAssignCenter
Success_manager_self_assign_center?: SuccessManagerSelfAssignCenter
Request_account_access_send?: RequestAccountAccessSend
Success_account_access_send?: SuccessAccountAccessSend
Request_account_access_revoke?: RequestAccountAccessRevoke
Success_account_access_revoke?: SuccessAccountAccessRevoke
Request_account_access_accept?: RequestAccountAccessAccept
Success_account_access_accept?: SuccessAccountAccessAccept
Request_account_link_remove?: RequestAccountLinkRemove
Success_account_link_remove?: SuccessAccountLinkRemove
Request_people_list?: RequestPeopleList
Success_people_list?: SuccessPeopleList
Request_person_get?: RequestPersonGet
Success_person_get?: SuccessPersonGet
Request_person_create?: RequestPersonCreate
Success_person_create?: SuccessPersonCreate
Request_person_update?: RequestPersonUpdate
Success_person_update?: SuccessPersonUpdate
Request_student_activate?: RequestStudentActivate
Success_student_activate?: SuccessStudentActivate
Request_student_deactivate?: RequestStudentDeactivate
Success_student_deactivate?: SuccessStudentDeactivate
Request_person_merge_preview?: RequestPersonMergePreview
Success_person_merge_preview?: SuccessPersonMergePreview
Request_person_merge_approve?: RequestPersonMergeApprove
Success_person_merge_approve?: SuccessPersonMergeApprove
Request_person_merge_apply?: RequestPersonMergeApply
Success_person_merge_apply?: SuccessPersonMergeApply
Request_calendar_get?: RequestCalendarGet
Success_calendar_get?: SuccessCalendarGet
Request_class_save?: RequestClassSave
Success_class_save?: SuccessClassSave
Request_program_preview?: RequestProgramPreview
Success_program_preview?: SuccessProgramPreview
Request_program_apply?: RequestProgramApply
Success_program_apply?: SuccessProgramApply
Request_session_create?: RequestSessionCreate
Success_session_create?: SuccessSessionCreate
Request_session_get?: RequestSessionGet
Success_session_get?: SuccessSessionGet
Request_session_change_preview?: RequestSessionChangePreview
Success_session_change_preview?: SuccessSessionChangePreview
Request_session_change_apply?: RequestSessionChangeApply
Success_session_change_apply?: SuccessSessionChangeApply
Request_session_capacity_set?: RequestSessionCapacitySet
Success_session_capacity_set?: SuccessSessionCapacitySet
Request_session_cancel_preview?: RequestSessionCancelPreview
Success_session_cancel_preview?: SuccessSessionCancelPreview
Request_session_cancel_apply?: RequestSessionCancelApply
Success_session_cancel_apply?: SuccessSessionCancelApply
Request_replacement_session_create?: RequestReplacementSessionCreate
Success_replacement_session_create?: SuccessReplacementSessionCreate
Request_session_assignment_set?: RequestSessionAssignmentSet
Success_session_assignment_set?: SuccessSessionAssignmentSet
Request_lesson_request_create?: RequestLessonRequestCreate
Success_lesson_request_create?: SuccessLessonRequestCreate
Request_lesson_request_withdraw?: RequestLessonRequestWithdraw
Success_lesson_request_withdraw?: SuccessLessonRequestWithdraw
Request_lesson_request_reject?: RequestLessonRequestReject
Success_lesson_request_reject?: SuccessLessonRequestReject
Request_lesson_request_offer_alternative?: RequestLessonRequestOfferAlternative
Success_lesson_request_offer_alternative?: SuccessLessonRequestOfferAlternative
Request_lesson_request_accept_alternative?: RequestLessonRequestAcceptAlternative
Success_lesson_request_accept_alternative?: SuccessLessonRequestAcceptAlternative
Request_lesson_request_approve?: RequestLessonRequestApprove
Success_lesson_request_approve?: SuccessLessonRequestApprove
Request_reservation_create?: RequestReservationCreate
Success_reservation_create?: SuccessReservationCreate
Request_reservation_cancel?: RequestReservationCancel
Success_reservation_cancel?: SuccessReservationCancel
Request_reservation_list?: RequestReservationList
Success_reservation_list?: SuccessReservationList
Request_waitlist_join?: RequestWaitlistJoin
Success_waitlist_join?: SuccessWaitlistJoin
Request_waitlist_leave?: RequestWaitlistLeave
Success_waitlist_leave?: SuccessWaitlistLeave
Request_seat_offer_accept?: RequestSeatOfferAccept
Success_seat_offer_accept?: SuccessSeatOfferAccept
Request_seat_offer_reject?: RequestSeatOfferReject
Success_seat_offer_reject?: SuccessSeatOfferReject
Request_attendance_get?: RequestAttendanceGet
Success_attendance_get?: SuccessAttendanceGet
Request_attendance_mark?: RequestAttendanceMark
Success_attendance_mark?: SuccessAttendanceMark
Request_attendance_close?: RequestAttendanceClose
Success_attendance_close?: SuccessAttendanceClose
Request_attendance_correct_preview?: RequestAttendanceCorrectPreview
Success_attendance_correct_preview?: SuccessAttendanceCorrectPreview
Request_attendance_correct_apply?: RequestAttendanceCorrectApply
Success_attendance_correct_apply?: SuccessAttendanceCorrectApply
Request_products_list?: RequestProductsList
Success_products_list?: SuccessProductsList
Request_product_publish?: RequestProductPublish
Success_product_publish?: SuccessProductPublish
Request_sale_preview?: RequestSalePreview
Success_sale_preview?: SuccessSalePreview
Request_sale_apply?: RequestSaleApply
Success_sale_apply?: SuccessSaleApply
Request_entitlements_get?: RequestEntitlementsGet
Success_entitlements_get?: SuccessEntitlementsGet
Request_entitlement_extend?: RequestEntitlementExtend
Success_entitlement_extend?: SuccessEntitlementExtend
Request_credit_adjust?: RequestCreditAdjust
Success_credit_adjust?: SuccessCreditAdjust
Request_negative_limit_set?: RequestNegativeLimitSet
Success_negative_limit_set?: SuccessNegativeLimitSet
Request_freeze_preview?: RequestFreezePreview
Success_freeze_preview?: SuccessFreezePreview
Request_freeze_apply?: RequestFreezeApply
Success_freeze_apply?: SuccessFreezeApply
Request_freeze_end_preview?: RequestFreezeEndPreview
Success_freeze_end_preview?: SuccessFreezeEndPreview
Request_freeze_end_apply?: RequestFreezeEndApply
Success_freeze_end_apply?: SuccessFreezeEndApply
Request_sale_terminate_preview?: RequestSaleTerminatePreview
Success_sale_terminate_preview?: SuccessSaleTerminatePreview
Request_sale_terminate_apply?: RequestSaleTerminateApply
Success_sale_terminate_apply?: SuccessSaleTerminateApply
Request_sale_refund_preview?: RequestSaleRefundPreview
Success_sale_refund_preview?: SuccessSaleRefundPreview
Request_sale_refund_apply?: RequestSaleRefundApply
Success_sale_refund_apply?: SuccessSaleRefundApply
Request_sale_change_preview?: RequestSaleChangePreview
Success_sale_change_preview?: SuccessSaleChangePreview
Request_sale_change_apply?: RequestSaleChangeApply
Success_sale_change_apply?: SuccessSaleChangeApply
Request_sale_renew_preview?: RequestSaleRenewPreview
Success_sale_renew_preview?: SuccessSaleRenewPreview
Request_sale_renew_apply?: RequestSaleRenewApply
Success_sale_renew_apply?: SuccessSaleRenewApply
Request_finance_get?: RequestFinanceGet
Success_finance_get?: SuccessFinanceGet
Request_collection_record?: RequestCollectionRecord
Success_collection_record?: SuccessCollectionRecord
Request_collection_correct_preview?: RequestCollectionCorrectPreview
Success_collection_correct_preview?: SuccessCollectionCorrectPreview
Request_collection_correct_apply?: RequestCollectionCorrectApply
Success_collection_correct_apply?: SuccessCollectionCorrectApply
Request_student_credit_refund?: RequestStudentCreditRefund
Success_student_credit_refund?: SuccessStudentCreditRefund
Request_student_credit_offset?: RequestStudentCreditOffset
Success_student_credit_offset?: SuccessStudentCreditOffset
Request_debt_adjust?: RequestDebtAdjust
Success_debt_adjust?: SuccessDebtAdjust
Request_instructor_agreement_publish?: RequestInstructorAgreementPublish
Success_instructor_agreement_publish?: SuccessInstructorAgreementPublish
Request_earnings_list?: RequestEarningsList
Success_earnings_list?: SuccessEarningsList
Request_instructor_payment_record?: RequestInstructorPaymentRecord
Success_instructor_payment_record?: SuccessInstructorPaymentRecord
Request_instructor_payment_correct?: RequestInstructorPaymentCorrect
Success_instructor_payment_correct?: SuccessInstructorPaymentCorrect
Request_leads_list?: RequestLeadsList
Success_leads_list?: SuccessLeadsList
Request_lead_save?: RequestLeadSave
Success_lead_save?: SuccessLeadSave
Request_crm_activity_save?: RequestCrmActivitySave
Success_crm_activity_save?: SuccessCrmActivitySave
Request_trial_offer_create?: RequestTrialOfferCreate
Success_trial_offer_create?: SuccessTrialOfferCreate
Request_trial_registration_confirm?: RequestTrialRegistrationConfirm
Success_trial_registration_confirm?: SuccessTrialRegistrationConfirm
Request_lead_convert?: RequestLeadConvert
Success_lead_convert?: SuccessLeadConvert
Request_crm_followup_list?: RequestCrmFollowupList
Success_crm_followup_list?: SuccessCrmFollowupList
Request_segment_save?: RequestSegmentSave
Success_segment_save?: SuccessSegmentSave
Request_automation_save?: RequestAutomationSave
Success_automation_save?: SuccessAutomationSave
Request_notifications_list?: RequestNotificationsList
Success_notifications_list?: SuccessNotificationsList
Request_notification_mark_read?: RequestNotificationMarkRead
Success_notification_mark_read?: SuccessNotificationMarkRead
Request_notification_preferences_set?: RequestNotificationPreferencesSet
Success_notification_preferences_set?: SuccessNotificationPreferencesSet
Request_report_get?: RequestReportGet
Success_report_get?: SuccessReportGet
Request_report_export_start?: RequestReportExportStart
Success_report_export_start?: SuccessReportExportStart
Request_report_file_get?: RequestReportFileGet
Success_report_file_get?: SuccessReportFileGet
Request_import_upload_prepare?: RequestImportUploadPrepare
Success_import_upload_prepare?: SuccessImportUploadPrepare
Request_import_preview?: RequestImportPreview
Success_import_preview?: SuccessImportPreview
Request_import_apply?: RequestImportApply
Success_import_apply?: SuccessImportApply
Request_import_rows_list?: RequestImportRowsList
Success_import_rows_list?: SuccessImportRowsList
Request_subscription_get?: RequestSubscriptionGet
Success_subscription_get?: SuccessSubscriptionGet
Request_subscription_upgrade_quote?: RequestSubscriptionUpgradeQuote
Success_subscription_upgrade_quote?: SuccessSubscriptionUpgradeQuote
Request_subscription_downgrade_request?: RequestSubscriptionDowngradeRequest
Success_subscription_downgrade_request?: SuccessSubscriptionDowngradeRequest
Request_subscription_change_cancel?: RequestSubscriptionChangeCancel
Success_subscription_change_cancel?: SuccessSubscriptionChangeCancel
Request_subscription_renewal_set?: RequestSubscriptionRenewalSet
Success_subscription_renewal_set?: SuccessSubscriptionRenewalSet
Request_saas_payment_submit?: RequestSaasPaymentSubmit
Success_saas_payment_submit?: SuccessSaasPaymentSubmit
Request_saas_payment_verify?: RequestSaasPaymentVerify
Success_saas_payment_verify?: SuccessSaasPaymentVerify
Request_saas_grace_extend?: RequestSaasGraceExtend
Success_saas_grace_extend?: SuccessSaasGraceExtend
Request_event_save?: RequestEventSave
Success_event_save?: SuccessEventSave
Request_event_publish?: RequestEventPublish
Success_event_publish?: SuccessEventPublish
Request_event_register?: RequestEventRegister
Success_event_register?: SuccessEventRegister
Request_event_registration_cancel?: RequestEventRegistrationCancel
Success_event_registration_cancel?: SuccessEventRegistrationCancel
Request_event_complete?: RequestEventComplete
Success_event_complete?: SuccessEventComplete
Request_event_duty_verify?: RequestEventDutyVerify
Success_event_duty_verify?: SuccessEventDutyVerify
Request_event_cancel_preview?: RequestEventCancelPreview
Success_event_cancel_preview?: SuccessEventCancelPreview
Request_event_cancel_apply?: RequestEventCancelApply
Success_event_cancel_apply?: SuccessEventCancelApply
Request_event_list?: RequestEventList
Success_event_list?: SuccessEventList
Request_document_upload_prepare?: RequestDocumentUploadPrepare
Success_document_upload_prepare?: SuccessDocumentUploadPrepare
Request_document_version_publish?: RequestDocumentVersionPublish
Success_document_version_publish?: SuccessDocumentVersionPublish
Request_document_requirements_get?: RequestDocumentRequirementsGet
Success_document_requirements_get?: SuccessDocumentRequirementsGet
Request_document_accept?: RequestDocumentAccept
Success_document_accept?: SuccessDocumentAccept
Request_publication_set?: RequestPublicationSet
Success_publication_set?: SuccessPublicationSet
Request_public_calendar_get?: RequestPublicCalendarGet
Success_public_calendar_get?: SuccessPublicCalendarGet
Request_public_application_submit?: RequestPublicApplicationSubmit
Success_public_application_submit?: SuccessPublicApplicationSubmit
Request_public_application_review?: RequestPublicApplicationReview
Success_public_application_review?: SuccessPublicApplicationReview
Request_operation_status_get?: RequestOperationStatusGet
Success_operation_status_get?: SuccessOperationStatusGet
Request_preview_get?: RequestPreviewGet
Success_preview_get?: SuccessPreviewGet
Request_job_status_get?: RequestJobStatusGet
Success_job_status_get?: SuccessJobStatusGet
Request_audit_list?: RequestAuditList
Success_audit_list?: SuccessAuditList
Request_seat_offer_issue?: RequestSeatOfferIssue
Success_seat_offer_issue?: SuccessSeatOfferIssue
Request_seat_offer_expire?: RequestSeatOfferExpire
Success_seat_offer_expire?: SuccessSeatOfferExpire
Request_request_expire?: RequestRequestExpire
Success_request_expire?: SuccessRequestExpire
Request_outbox_deliver?: RequestOutboxDeliver
Success_outbox_deliver?: SuccessOutboxDeliver
Request_reminder_schedule?: RequestReminderSchedule
Success_reminder_schedule?: SuccessReminderSchedule
Request_automation_run?: RequestAutomationRun
Success_automation_run?: SuccessAutomationRun
Request_import_rows_process?: RequestImportRowsProcess
Success_import_rows_process?: SuccessImportRowsProcess
Request_report_build?: RequestReportBuild
Success_report_build?: SuccessReportBuild
Request_privacy_execute?: RequestPrivacyExecute
Success_privacy_execute?: SuccessPrivacyExecute
Request_subscription_boundary_apply?: RequestSubscriptionBoundaryApply
Success_subscription_boundary_apply?: SuccessSubscriptionBoundaryApply
Request_class_assignment_set?: RequestClassAssignmentSet
Success_class_assignment_set?: SuccessClassAssignmentSet
Request_event_attendance_mark?: RequestEventAttendanceMark
Success_event_attendance_mark?: SuccessEventAttendanceMark
Request_platform_owner_set?: RequestPlatformOwnerSet
Success_platform_owner_set?: SuccessPlatformOwnerSet
Request_platform_owner_remove?: RequestPlatformOwnerRemove
Success_platform_owner_remove?: SuccessPlatformOwnerRemove
Request_center_manager_assign?: RequestCenterManagerAssign
Success_center_manager_assign?: SuccessCenterManagerAssign
Request_center_manager_revoke?: RequestCenterManagerRevoke
Success_center_manager_revoke?: SuccessCenterManagerRevoke
Request_attendance_block?: RequestAttendanceBlock
Success_attendance_block?: SuccessAttendanceBlock
Request_event_attendance_close?: RequestEventAttendanceClose
Success_event_attendance_close?: SuccessEventAttendanceClose
Request_event_attendance_correct?: RequestEventAttendanceCorrect
Success_event_attendance_correct?: SuccessEventAttendanceCorrect
Request_file_upload_complete?: RequestFileUploadComplete
Success_file_upload_complete?: SuccessFileUploadComplete
Request_negcredit_valuation_set?: RequestNegcreditValuationSet
Success_negcredit_valuation_set?: SuccessNegcreditValuationSet
Table_organizations?: TableOrganizations
Table_centers?: TableCenters
Table_rooms?: TableRooms
Table_room_capacities?: TableRoomCapacities
Table_availability_rules?: TableAvailabilityRules
Table_availability_exceptions?: TableAvailabilityExceptions
Table_policy_versions?: TablePolicyVersions
Table_accounts?: TableAccounts
Table_account_links?: TableAccountLinks
Table_role_assignments?: TableRoleAssignments
Table_permission_overrides?: TablePermissionOverrides
Table_invitations?: TableInvitations
Table_people?: TablePeople
Table_person_contacts?: TablePersonContacts
Table_center_relationships?: TableCenterRelationships
Table_merge_requests?: TableMergeRequests
Table_merge_approvals?: TableMergeApprovals
Table_classes?: TableClasses
Table_program_versions?: TableProgramVersions
Table_sessions?: TableSessions
Table_session_assignments?: TableSessionAssignments
Table_resource_bookings?: TableResourceBookings
Table_lesson_requests?: TableLessonRequests
Table_request_alternatives?: TableRequestAlternatives
Table_reservations?: TableReservations
Table_waitlist_entries?: TableWaitlistEntries
Table_seat_offers?: TableSeatOffers
Table_attendance_entries?: TableAttendanceEntries
Table_attendance_closures?: TableAttendanceClosures
Table_products?: TableProducts
Table_product_versions?: TableProductVersions
Table_product_scopes?: TableProductScopes
Table_sales?: TableSales
Table_entitlement_accounts?: TableEntitlementAccounts
Table_entitlement_movements?: TableEntitlementMovements
Table_entitlement_allocations?: TableEntitlementAllocations
Table_credit_deficits?: TableCreditDeficits
Table_quota_buckets?: TableQuotaBuckets
Table_freezes?: TableFreezes
Table_negative_limit_overrides?: TableNegativeLimitOverrides
Table_debts?: TableDebts
Table_cash_movements?: TableCashMovements
Table_debt_allocations?: TableDebtAllocations
Table_student_credit_movements?: TableStudentCreditMovements
Table_debt_adjustments?: TableDebtAdjustments
Table_instructor_agreements?: TableInstructorAgreements
Table_earnings?: TableEarnings
Table_instructor_payments?: TableInstructorPayments
Table_earning_allocations?: TableEarningAllocations
Table_leads?: TableLeads
Table_crm_activities?: TableCrmActivities
Table_trial_offers?: TableTrialOffers
Table_trial_usages?: TableTrialUsages
Table_segments?: TableSegments
Table_automations?: TableAutomations
Table_automation_runs?: TableAutomationRuns
Table_notification_preferences?: TableNotificationPreferences
Table_notifications?: TableNotifications
Table_outbox_jobs?: TableOutboxJobs
Table_report_jobs?: TableReportJobs
Table_saas_plan_versions?: TableSaasPlanVersions
Table_saas_subscriptions?: TableSaasSubscriptions
Table_saas_change_requests?: TableSaasChangeRequests
Table_saas_quotes?: TableSaasQuotes
Table_saas_payment_verifications?: TableSaasPaymentVerifications
Table_events?: TableEvents
Table_event_assignments?: TableEventAssignments
Table_event_registrations?: TableEventRegistrations
Table_documents?: TableDocuments
Table_document_versions?: TableDocumentVersions
Table_document_requirements?: TableDocumentRequirements
Table_document_acceptances?: TableDocumentAcceptances
Table_files?: TableFiles
Table_previews?: TablePreviews
Table_operation_receipts?: TableOperationReceipts
Table_audit_events?: TableAuditEvents
Table_import_jobs?: TableImportJobs
Table_import_rows?: TableImportRows
Table_publications?: TablePublications
Table_public_applications?: TablePublicApplications
Table_privacy_requests?: TablePrivacyRequests
Table_retention_holds?: TableRetentionHolds
Table_deletion_receipts?: TableDeletionReceipts
Table_class_assignments?: TableClassAssignments
Table_rate_limit_windows?: TableRateLimitWindows
FtkGeneratedUuidV7?: FtkGeneratedUuidV7
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
FtkUuid?: string
/**
 * Provider-owned UUID; preserve version and value.
 */
ProviderUuid?: string
PackageScopeKind?: PackageScopeKind
UsageTarget?: UsageTarget
DeficitScopeView?: DeficitScopeView
Table_disciplines?: TableDisciplines
Table_center_disciplines?: TableCenterDisciplines
DisciplineRelationshipKind?: DisciplineRelationshipKind
Table_person_disciplines?: TablePersonDisciplines
DisciplineView?: DisciplineView
DisciplinePage?: DisciplinePage
Request_disciplines_list?: RequestDisciplinesList
Success_disciplines_list?: SuccessDisciplinesList
Request_discipline_save?: RequestDisciplineSave
Success_discipline_save?: SuccessDisciplineSave
Request_center_discipline_set?: RequestCenterDisciplineSet
Success_center_discipline_set?: SuccessCenterDisciplineSet
Request_person_discipline_set?: RequestPersonDisciplineSet
Success_person_discipline_set?: SuccessPersonDisciplineSet
PackageScopeCenterDiscipline?: PackageScopeCenterDiscipline
PackageScopeCenterAllDisciplines?: PackageScopeCenterAllDisciplines
PackageScopeOrganizationDiscipline?: PackageScopeOrganizationDiscipline
PackageScopeOrganizationAll?: PackageScopeOrganizationAll
DisciplineRelationshipView?: DisciplineRelationshipView
EventDisciplineIds?: EventDisciplineIds
Table_event_disciplines?: TableEventDisciplines
Request_event_get?: RequestEventGet
Success_event_get?: SuccessEventGet
Request_event_registration_preview?: RequestEventRegistrationPreview
Success_event_registration_preview?: SuccessEventRegistrationPreview
EarningDirection?: EarningDirection
FailureEnvelope?: FailureEnvelope
EventRegistrationView?: EventRegistrationView
EventDutyView?: EventDutyView
EventPaymentPreparationState?: EventPaymentPreparationState
Table_event_payment_preparations?: TableEventPaymentPreparations
EventPaymentPreparationView?: EventPaymentPreparationView
EventRegistered?: EventRegistered
EventCapacityClosed?: EventCapacityClosed
EventRegistrationResult?: EventRegistrationResult
Request_event_payment_prepare?: RequestEventPaymentPrepare
Request_event_payment_get?: RequestEventPaymentGet
Success_event_payment_prepare?: SuccessEventPaymentPrepare
Success_event_payment_get?: SuccessEventPaymentGet
ParticipantCancellationBasis?: ParticipantCancellationBasis
ActualStartHistoryItem?: ActualStartHistoryItem
Request_event_actual_start_record?: RequestEventActualStartRecord
Success_event_actual_start_record?: SuccessEventActualStartRecord
Request_event_actual_start_correct?: RequestEventActualStartCorrect
Success_event_actual_start_correct?: SuccessEventActualStartCorrect
LocalOffsetChoice?: LocalOffsetChoice
ClassAssignmentView?: ClassAssignmentView
SchedulePreviewItem?: SchedulePreviewItem
AgreementPackageTerms?: AgreementPackageTerms
AgreementVersionView?: AgreementVersionView
AgreementVersionPage?: AgreementVersionPage
ManagementStateView?: ManagementStateView
PolicyProtectionChange?: PolicyProtectionChange
NegativeLimitProtectionChange?: NegativeLimitProtectionChange
CreditProtectionChange?: CreditProtectionChange
SaleScopeProtectionChange?: SaleScopeProtectionChange
ReservationProtectionChange?: ReservationProtectionChange
ProtectedObligationView?: ProtectedObligationView
ReservationProtectionPreview?: ReservationProtectionPreview
Target_policy_publish_protected?: TargetPolicyPublishProtected
SettlementRequestState?: SettlementRequestState
SettlementLine?: SettlementLine
SettlementMovementView?: SettlementMovementView
SettlementRequestView?: SettlementRequestView
SettlementMovementsPage?: SettlementMovementsPage
SettlementRequestsPage?: SettlementRequestsPage
SettlementCommandResult?: SettlementCommandResult
SettlementRuleSet?: SettlementRuleSet
Request_management_state_get?: RequestManagementStateGet
Success_management_state_get?: SuccessManagementStateGet
Request_instructor_agreements_list?: RequestInstructorAgreementsList
Success_instructor_agreements_list?: SuccessInstructorAgreementsList
Request_reservation_impact_preview?: RequestReservationImpactPreview
Success_reservation_impact_preview?: SuccessReservationImpactPreview
Request_reservation_impact_apply?: RequestReservationImpactApply
Success_reservation_impact_apply?: SuccessReservationImpactApply
Request_settlement_movements_list?: RequestSettlementMovementsList
Success_settlement_movements_list?: SuccessSettlementMovementsList
Request_settlement_requests_list?: RequestSettlementRequestsList
Success_settlement_requests_list?: SuccessSettlementRequestsList
Request_settlement_request_get?: RequestSettlementRequestGet
Success_settlement_request_get?: SuccessSettlementRequestGet
Request_settlement_request_submit?: RequestSettlementRequestSubmit
Success_settlement_request_submit?: SuccessSettlementRequestSubmit
Request_settlement_request_withdraw?: RequestSettlementRequestWithdraw
Success_settlement_request_withdraw?: SuccessSettlementRequestWithdraw
Request_settlement_request_decide?: RequestSettlementRequestDecide
Success_settlement_request_decide?: SuccessSettlementRequestDecide
ManagementProjection_account_profile_update_v1?: ManagementProjectionAccountProfileUpdateV1
ManagementProjection_account_delete_preview_v1?: ManagementProjectionAccountDeletePreviewV1
ManagementProjection_account_delete_apply_v1?: ManagementProjectionAccountDeleteApplyV1
ManagementProjection_organization_create_v1?: ManagementProjectionOrganizationCreateV1
ManagementProjection_organization_update_v1?: ManagementProjectionOrganizationUpdateV1
ManagementProjection_organization_close_preview_v1?: ManagementProjectionOrganizationClosePreviewV1
ManagementProjection_organization_close_apply_v1?: ManagementProjectionOrganizationCloseApplyV1
ManagementProjection_organization_reopen_v1?: ManagementProjectionOrganizationReopenV1
ManagementProjection_organization_delete_preview_v1?: ManagementProjectionOrganizationDeletePreviewV1
ManagementProjection_organization_delete_apply_v1?: ManagementProjectionOrganizationDeleteApplyV1
ManagementProjection_center_create_v1?: ManagementProjectionCenterCreateV1
ManagementProjection_center_update_v1?: ManagementProjectionCenterUpdateV1
ManagementProjection_room_save_v1?: ManagementProjectionRoomSaveV1
ManagementProjection_availability_save_v1?: ManagementProjectionAvailabilitySaveV1
ManagementProjection_availability_exception_save_v1?: ManagementProjectionAvailabilityExceptionSaveV1
ManagementProjection_policy_publish_v1?: ManagementProjectionPolicyPublishV1
ManagementProjection_role_assign_v1?: ManagementProjectionRoleAssignV1
ManagementProjection_role_revoke_v1?: ManagementProjectionRoleRevokeV1
ManagementProjection_permission_set_v1?: ManagementProjectionPermissionSetV1
ManagementProjection_org_manager_assign_v1?: ManagementProjectionOrgManagerAssignV1
ManagementProjection_org_manager_revoke_v1?: ManagementProjectionOrgManagerRevokeV1
ManagementProjection_manager_self_assign_center_v1?: ManagementProjectionManagerSelfAssignCenterV1
ManagementProjection_account_access_send_v1?: ManagementProjectionAccountAccessSendV1
ManagementProjection_account_access_revoke_v1?: ManagementProjectionAccountAccessRevokeV1
ManagementProjection_account_access_accept_v1?: ManagementProjectionAccountAccessAcceptV1
ManagementProjection_account_link_remove_v1?: ManagementProjectionAccountLinkRemoveV1
ManagementProjection_person_create_v1?: ManagementProjectionPersonCreateV1
ManagementProjection_person_update_v1?: ManagementProjectionPersonUpdateV1
ManagementProjection_student_activate_v1?: ManagementProjectionStudentActivateV1
ManagementProjection_student_deactivate_v1?: ManagementProjectionStudentDeactivateV1
ManagementProjection_person_merge_preview_v1?: ManagementProjectionPersonMergePreviewV1
ManagementProjection_person_merge_approve_v1?: ManagementProjectionPersonMergeApproveV1
ManagementProjection_person_merge_apply_v1?: ManagementProjectionPersonMergeApplyV1
ManagementProjection_class_save_v1?: ManagementProjectionClassSaveV1
ManagementProjection_program_preview_v1?: ManagementProjectionProgramPreviewV1
ManagementProjection_program_apply_v1?: ManagementProjectionProgramApplyV1
ManagementProjection_session_create_v1?: ManagementProjectionSessionCreateV1
ManagementProjection_session_change_preview_v1?: ManagementProjectionSessionChangePreviewV1
ManagementProjection_session_change_apply_v1?: ManagementProjectionSessionChangeApplyV1
ManagementProjection_session_capacity_set_v1?: ManagementProjectionSessionCapacitySetV1
ManagementProjection_session_cancel_preview_v1?: ManagementProjectionSessionCancelPreviewV1
ManagementProjection_session_cancel_apply_v1?: ManagementProjectionSessionCancelApplyV1
ManagementProjection_replacement_session_create_v1?: ManagementProjectionReplacementSessionCreateV1
ManagementProjection_session_assignment_set_v1?: ManagementProjectionSessionAssignmentSetV1
ManagementProjection_lesson_request_create_v1?: ManagementProjectionLessonRequestCreateV1
ManagementProjection_lesson_request_withdraw_v1?: ManagementProjectionLessonRequestWithdrawV1
ManagementProjection_lesson_request_reject_v1?: ManagementProjectionLessonRequestRejectV1
ManagementProjection_lesson_request_offer_alternative_v1?: ManagementProjectionLessonRequestOfferAlternativeV1
ManagementProjection_lesson_request_accept_alternative_v1?: ManagementProjectionLessonRequestAcceptAlternativeV1
ManagementProjection_lesson_request_approve_v1?: ManagementProjectionLessonRequestApproveV1
ManagementProjection_reservation_create_v1?: ManagementProjectionReservationCreateV1
ManagementProjection_reservation_cancel_v1?: ManagementProjectionReservationCancelV1
ManagementProjection_waitlist_join_v1?: ManagementProjectionWaitlistJoinV1
ManagementProjection_waitlist_leave_v1?: ManagementProjectionWaitlistLeaveV1
ManagementProjection_seat_offer_accept_v1?: ManagementProjectionSeatOfferAcceptV1
ManagementProjection_seat_offer_reject_v1?: ManagementProjectionSeatOfferRejectV1
ManagementProjection_attendance_mark_v1?: ManagementProjectionAttendanceMarkV1
ManagementProjection_attendance_close_v1?: ManagementProjectionAttendanceCloseV1
ManagementProjection_attendance_correct_preview_v1?: ManagementProjectionAttendanceCorrectPreviewV1
ManagementProjection_attendance_correct_apply_v1?: ManagementProjectionAttendanceCorrectApplyV1
ManagementProjection_product_publish_v1?: ManagementProjectionProductPublishV1
ManagementProjection_sale_preview_v1?: ManagementProjectionSalePreviewV1
ManagementProjection_sale_apply_v1?: ManagementProjectionSaleApplyV1
ManagementProjection_entitlement_extend_v1?: ManagementProjectionEntitlementExtendV1
ManagementProjection_credit_adjust_v1?: ManagementProjectionCreditAdjustV1
ManagementProjection_negative_limit_set_v1?: ManagementProjectionNegativeLimitSetV1
ManagementProjection_freeze_preview_v1?: ManagementProjectionFreezePreviewV1
ManagementProjection_freeze_apply_v1?: ManagementProjectionFreezeApplyV1
ManagementProjection_freeze_end_preview_v1?: ManagementProjectionFreezeEndPreviewV1
ManagementProjection_freeze_end_apply_v1?: ManagementProjectionFreezeEndApplyV1
ManagementProjection_sale_terminate_preview_v1?: ManagementProjectionSaleTerminatePreviewV1
ManagementProjection_sale_terminate_apply_v1?: ManagementProjectionSaleTerminateApplyV1
ManagementProjection_sale_refund_preview_v1?: ManagementProjectionSaleRefundPreviewV1
ManagementProjection_sale_refund_apply_v1?: ManagementProjectionSaleRefundApplyV1
ManagementProjection_sale_change_preview_v1?: ManagementProjectionSaleChangePreviewV1
ManagementProjection_sale_change_apply_v1?: ManagementProjectionSaleChangeApplyV1
ManagementProjection_sale_renew_preview_v1?: ManagementProjectionSaleRenewPreviewV1
ManagementProjection_sale_renew_apply_v1?: ManagementProjectionSaleRenewApplyV1
ManagementProjection_collection_record_v1?: ManagementProjectionCollectionRecordV1
ManagementProjection_collection_correct_preview_v1?: ManagementProjectionCollectionCorrectPreviewV1
ManagementProjection_collection_correct_apply_v1?: ManagementProjectionCollectionCorrectApplyV1
ManagementProjection_student_credit_refund_v1?: ManagementProjectionStudentCreditRefundV1
ManagementProjection_student_credit_offset_v1?: ManagementProjectionStudentCreditOffsetV1
ManagementProjection_debt_adjust_v1?: ManagementProjectionDebtAdjustV1
ManagementProjection_instructor_agreement_publish_v1?: ManagementProjectionInstructorAgreementPublishV1
ManagementProjection_instructor_payment_record_v1?: ManagementProjectionInstructorPaymentRecordV1
ManagementProjection_instructor_payment_correct_v1?: ManagementProjectionInstructorPaymentCorrectV1
ManagementProjection_lead_save_v1?: ManagementProjectionLeadSaveV1
ManagementProjection_crm_activity_save_v1?: ManagementProjectionCrmActivitySaveV1
ManagementProjection_trial_offer_create_v1?: ManagementProjectionTrialOfferCreateV1
ManagementProjection_trial_registration_confirm_v1?: ManagementProjectionTrialRegistrationConfirmV1
ManagementProjection_lead_convert_v1?: ManagementProjectionLeadConvertV1
ManagementProjection_segment_save_v1?: ManagementProjectionSegmentSaveV1
ManagementProjection_automation_save_v1?: ManagementProjectionAutomationSaveV1
ManagementProjection_notification_mark_read_v1?: ManagementProjectionNotificationMarkReadV1
ManagementProjection_notification_preferences_set_v1?: ManagementProjectionNotificationPreferencesSetV1
ManagementProjection_report_export_start_v1?: ManagementProjectionReportExportStartV1
ManagementProjection_import_upload_prepare_v1?: ManagementProjectionImportUploadPrepareV1
ManagementProjection_import_preview_v1?: ManagementProjectionImportPreviewV1
ManagementProjection_import_apply_v1?: ManagementProjectionImportApplyV1
ManagementProjection_subscription_upgrade_quote_v1?: ManagementProjectionSubscriptionUpgradeQuoteV1
ManagementProjection_subscription_downgrade_request_v1?: ManagementProjectionSubscriptionDowngradeRequestV1
ManagementProjection_subscription_change_cancel_v1?: ManagementProjectionSubscriptionChangeCancelV1
ManagementProjection_subscription_renewal_set_v1?: ManagementProjectionSubscriptionRenewalSetV1
ManagementProjection_saas_payment_submit_v1?: ManagementProjectionSaasPaymentSubmitV1
ManagementProjection_saas_payment_verify_v1?: ManagementProjectionSaasPaymentVerifyV1
ManagementProjection_saas_grace_extend_v1?: ManagementProjectionSaasGraceExtendV1
ManagementProjection_event_save_v1?: ManagementProjectionEventSaveV1
ManagementProjection_event_publish_v1?: ManagementProjectionEventPublishV1
ManagementProjection_event_register_v1?: ManagementProjectionEventRegisterV1
ManagementProjection_event_registration_cancel_v1?: ManagementProjectionEventRegistrationCancelV1
ManagementProjection_event_complete_v1?: ManagementProjectionEventCompleteV1
ManagementProjection_event_duty_verify_v1?: ManagementProjectionEventDutyVerifyV1
ManagementProjection_event_cancel_preview_v1?: ManagementProjectionEventCancelPreviewV1
ManagementProjection_event_cancel_apply_v1?: ManagementProjectionEventCancelApplyV1
ManagementProjection_document_upload_prepare_v1?: ManagementProjectionDocumentUploadPrepareV1
ManagementProjection_document_version_publish_v1?: ManagementProjectionDocumentVersionPublishV1
ManagementProjection_document_accept_v1?: ManagementProjectionDocumentAcceptV1
ManagementProjection_publication_set_v1?: ManagementProjectionPublicationSetV1
ManagementProjection_public_application_submit_v1?: ManagementProjectionPublicApplicationSubmitV1
ManagementProjection_public_application_review_v1?: ManagementProjectionPublicApplicationReviewV1
ManagementProjection_class_assignment_set_v1?: ManagementProjectionClassAssignmentSetV1
ManagementProjection_event_attendance_mark_v1?: ManagementProjectionEventAttendanceMarkV1
ManagementProjection_platform_owner_set_v1?: ManagementProjectionPlatformOwnerSetV1
ManagementProjection_platform_owner_remove_v1?: ManagementProjectionPlatformOwnerRemoveV1
ManagementProjection_center_manager_assign_v1?: ManagementProjectionCenterManagerAssignV1
ManagementProjection_center_manager_revoke_v1?: ManagementProjectionCenterManagerRevokeV1
ManagementProjection_attendance_block_v1?: ManagementProjectionAttendanceBlockV1
ManagementProjection_event_attendance_close_v1?: ManagementProjectionEventAttendanceCloseV1
ManagementProjection_event_attendance_correct_v1?: ManagementProjectionEventAttendanceCorrectV1
ManagementProjection_file_upload_complete_v1?: ManagementProjectionFileUploadCompleteV1
ManagementProjection_negcredit_valuation_set_v1?: ManagementProjectionNegcreditValuationSetV1
ManagementProjection_discipline_save_v1?: ManagementProjectionDisciplineSaveV1
ManagementProjection_center_discipline_set_v1?: ManagementProjectionCenterDisciplineSetV1
ManagementProjection_person_discipline_set_v1?: ManagementProjectionPersonDisciplineSetV1
ManagementProjection_event_registration_preview_v1?: ManagementProjectionEventRegistrationPreviewV1
ManagementProjection_event_payment_prepare_v1?: ManagementProjectionEventPaymentPrepareV1
ManagementProjection_event_actual_start_record_v1?: ManagementProjectionEventActualStartRecordV1
ManagementProjection_event_actual_start_correct_v1?: ManagementProjectionEventActualStartCorrectV1
ManagementProjection_reservation_impact_preview_v1?: ManagementProjectionReservationImpactPreviewV1
ManagementProjection_reservation_impact_apply_v1?: ManagementProjectionReservationImpactApplyV1
ManagementProjection_settlement_request_submit_v1?: ManagementProjectionSettlementRequestSubmitV1
ManagementProjection_settlement_request_withdraw_v1?: ManagementProjectionSettlementRequestWithdrawV1
ManagementProjection_settlement_request_decide_v1?: ManagementProjectionSettlementRequestDecideV1
ManagementProjection?: ManagementProjection
ManagementOperationName?: ManagementOperationName
ManagementSelector_account_profile_update_v1?: ManagementSelectorAccountProfileUpdateV1
ManagementSelector_account_delete_preview_v1?: ManagementSelectorAccountDeletePreviewV1
ManagementSelector_account_delete_apply_v1?: ManagementSelectorAccountDeleteApplyV1
ManagementSelector_organization_create_v1?: ManagementSelectorOrganizationCreateV1
ManagementSelector_organization_update_v1?: ManagementSelectorOrganizationUpdateV1
ManagementSelector_organization_close_preview_v1?: ManagementSelectorOrganizationClosePreviewV1
ManagementSelector_organization_close_apply_v1?: ManagementSelectorOrganizationCloseApplyV1
ManagementSelector_organization_reopen_v1?: ManagementSelectorOrganizationReopenV1
ManagementSelector_organization_delete_preview_v1?: ManagementSelectorOrganizationDeletePreviewV1
ManagementSelector_organization_delete_apply_v1?: ManagementSelectorOrganizationDeleteApplyV1
ManagementSelector_center_create_v1?: ManagementSelectorCenterCreateV1
ManagementSelector_center_update_v1?: ManagementSelectorCenterUpdateV1
ManagementSelector_room_save_v1?: ManagementSelectorRoomSaveV1
ManagementSelector_availability_save_v1?: ManagementSelectorAvailabilitySaveV1
ManagementSelector_availability_exception_save_v1?: ManagementSelectorAvailabilityExceptionSaveV1
ManagementSelector_policy_publish_v1?: ManagementSelectorPolicyPublishV1
ManagementSelector_role_assign_v1?: ManagementSelectorRoleAssignV1
ManagementSelector_role_revoke_v1?: ManagementSelectorRoleRevokeV1
ManagementSelector_permission_set_v1?: ManagementSelectorPermissionSetV1
ManagementSelector_org_manager_assign_v1?: ManagementSelectorOrgManagerAssignV1
ManagementSelector_org_manager_revoke_v1?: ManagementSelectorOrgManagerRevokeV1
ManagementSelector_manager_self_assign_center_v1?: ManagementSelectorManagerSelfAssignCenterV1
ManagementSelector_account_access_send_v1?: ManagementSelectorAccountAccessSendV1
ManagementSelector_account_access_revoke_v1?: ManagementSelectorAccountAccessRevokeV1
ManagementSelector_account_access_accept_v1?: ManagementSelectorAccountAccessAcceptV1
ManagementSelector_account_link_remove_v1?: ManagementSelectorAccountLinkRemoveV1
ManagementSelector_person_create_v1?: ManagementSelectorPersonCreateV1
ManagementSelector_person_update_v1?: ManagementSelectorPersonUpdateV1
ManagementSelector_student_activate_v1?: ManagementSelectorStudentActivateV1
ManagementSelector_student_deactivate_v1?: ManagementSelectorStudentDeactivateV1
ManagementSelector_person_merge_preview_v1?: ManagementSelectorPersonMergePreviewV1
ManagementSelector_person_merge_approve_v1?: ManagementSelectorPersonMergeApproveV1
ManagementSelector_person_merge_apply_v1?: ManagementSelectorPersonMergeApplyV1
ManagementSelector_class_save_v1?: ManagementSelectorClassSaveV1
ManagementSelector_program_preview_v1?: ManagementSelectorProgramPreviewV1
ManagementSelector_program_apply_v1?: ManagementSelectorProgramApplyV1
ManagementSelector_session_create_v1?: ManagementSelectorSessionCreateV1
ManagementSelector_session_change_preview_v1?: ManagementSelectorSessionChangePreviewV1
ManagementSelector_session_change_apply_v1?: ManagementSelectorSessionChangeApplyV1
ManagementSelector_session_capacity_set_v1?: ManagementSelectorSessionCapacitySetV1
ManagementSelector_session_cancel_preview_v1?: ManagementSelectorSessionCancelPreviewV1
ManagementSelector_session_cancel_apply_v1?: ManagementSelectorSessionCancelApplyV1
ManagementSelector_replacement_session_create_v1?: ManagementSelectorReplacementSessionCreateV1
ManagementSelector_session_assignment_set_v1?: ManagementSelectorSessionAssignmentSetV1
ManagementSelector_lesson_request_create_v1?: ManagementSelectorLessonRequestCreateV1
ManagementSelector_lesson_request_withdraw_v1?: ManagementSelectorLessonRequestWithdrawV1
ManagementSelector_lesson_request_reject_v1?: ManagementSelectorLessonRequestRejectV1
ManagementSelector_lesson_request_offer_alternative_v1?: ManagementSelectorLessonRequestOfferAlternativeV1
ManagementSelector_lesson_request_accept_alternative_v1?: ManagementSelectorLessonRequestAcceptAlternativeV1
ManagementSelector_lesson_request_approve_v1?: ManagementSelectorLessonRequestApproveV1
ManagementSelector_reservation_create_v1?: ManagementSelectorReservationCreateV1
ManagementSelector_reservation_cancel_v1?: ManagementSelectorReservationCancelV1
ManagementSelector_waitlist_join_v1?: ManagementSelectorWaitlistJoinV1
ManagementSelector_waitlist_leave_v1?: ManagementSelectorWaitlistLeaveV1
ManagementSelector_seat_offer_accept_v1?: ManagementSelectorSeatOfferAcceptV1
ManagementSelector_seat_offer_reject_v1?: ManagementSelectorSeatOfferRejectV1
ManagementSelector_attendance_mark_v1?: ManagementSelectorAttendanceMarkV1
ManagementSelector_attendance_close_v1?: ManagementSelectorAttendanceCloseV1
ManagementSelector_attendance_correct_preview_v1?: ManagementSelectorAttendanceCorrectPreviewV1
ManagementSelector_attendance_correct_apply_v1?: ManagementSelectorAttendanceCorrectApplyV1
ManagementSelector_product_publish_v1?: ManagementSelectorProductPublishV1
ManagementSelector_sale_preview_v1?: ManagementSelectorSalePreviewV1
ManagementSelector_sale_apply_v1?: ManagementSelectorSaleApplyV1
ManagementSelector_entitlement_extend_v1?: ManagementSelectorEntitlementExtendV1
ManagementSelector_credit_adjust_v1?: ManagementSelectorCreditAdjustV1
ManagementSelector_negative_limit_set_v1?: ManagementSelectorNegativeLimitSetV1
ManagementSelector_freeze_preview_v1?: ManagementSelectorFreezePreviewV1
ManagementSelector_freeze_apply_v1?: ManagementSelectorFreezeApplyV1
ManagementSelector_freeze_end_preview_v1?: ManagementSelectorFreezeEndPreviewV1
ManagementSelector_freeze_end_apply_v1?: ManagementSelectorFreezeEndApplyV1
ManagementSelector_sale_terminate_preview_v1?: ManagementSelectorSaleTerminatePreviewV1
ManagementSelector_sale_terminate_apply_v1?: ManagementSelectorSaleTerminateApplyV1
ManagementSelector_sale_refund_preview_v1?: ManagementSelectorSaleRefundPreviewV1
ManagementSelector_sale_refund_apply_v1?: ManagementSelectorSaleRefundApplyV1
ManagementSelector_sale_change_preview_v1?: ManagementSelectorSaleChangePreviewV1
ManagementSelector_sale_change_apply_v1?: ManagementSelectorSaleChangeApplyV1
ManagementSelector_sale_renew_preview_v1?: ManagementSelectorSaleRenewPreviewV1
ManagementSelector_sale_renew_apply_v1?: ManagementSelectorSaleRenewApplyV1
ManagementSelector_collection_record_v1?: ManagementSelectorCollectionRecordV1
ManagementSelector_collection_correct_preview_v1?: ManagementSelectorCollectionCorrectPreviewV1
ManagementSelector_collection_correct_apply_v1?: ManagementSelectorCollectionCorrectApplyV1
ManagementSelector_student_credit_refund_v1?: ManagementSelectorStudentCreditRefundV1
ManagementSelector_student_credit_offset_v1?: ManagementSelectorStudentCreditOffsetV1
ManagementSelector_debt_adjust_v1?: ManagementSelectorDebtAdjustV1
ManagementSelector_instructor_agreement_publish_v1?: ManagementSelectorInstructorAgreementPublishV1
ManagementSelector_instructor_payment_record_v1?: ManagementSelectorInstructorPaymentRecordV1
ManagementSelector_instructor_payment_correct_v1?: ManagementSelectorInstructorPaymentCorrectV1
ManagementSelector_lead_save_v1?: ManagementSelectorLeadSaveV1
ManagementSelector_crm_activity_save_v1?: ManagementSelectorCrmActivitySaveV1
ManagementSelector_trial_offer_create_v1?: ManagementSelectorTrialOfferCreateV1
ManagementSelector_trial_registration_confirm_v1?: ManagementSelectorTrialRegistrationConfirmV1
ManagementSelector_lead_convert_v1?: ManagementSelectorLeadConvertV1
ManagementSelector_segment_save_v1?: ManagementSelectorSegmentSaveV1
ManagementSelector_automation_save_v1?: ManagementSelectorAutomationSaveV1
ManagementSelector_notification_mark_read_v1?: ManagementSelectorNotificationMarkReadV1
ManagementSelector_notification_preferences_set_v1?: ManagementSelectorNotificationPreferencesSetV1
ManagementSelector_report_export_start_v1?: ManagementSelectorReportExportStartV1
ManagementSelector_import_upload_prepare_v1?: ManagementSelectorImportUploadPrepareV1
ManagementSelector_import_preview_v1?: ManagementSelectorImportPreviewV1
ManagementSelector_import_apply_v1?: ManagementSelectorImportApplyV1
ManagementSelector_subscription_upgrade_quote_v1?: ManagementSelectorSubscriptionUpgradeQuoteV1
ManagementSelector_subscription_downgrade_request_v1?: ManagementSelectorSubscriptionDowngradeRequestV1
ManagementSelector_subscription_change_cancel_v1?: ManagementSelectorSubscriptionChangeCancelV1
ManagementSelector_subscription_renewal_set_v1?: ManagementSelectorSubscriptionRenewalSetV1
ManagementSelector_saas_payment_submit_v1?: ManagementSelectorSaasPaymentSubmitV1
ManagementSelector_saas_payment_verify_v1?: ManagementSelectorSaasPaymentVerifyV1
ManagementSelector_saas_grace_extend_v1?: ManagementSelectorSaasGraceExtendV1
ManagementSelector_event_save_v1?: ManagementSelectorEventSaveV1
ManagementSelector_event_publish_v1?: ManagementSelectorEventPublishV1
ManagementSelector_event_register_v1?: ManagementSelectorEventRegisterV1
ManagementSelector_event_registration_cancel_v1?: ManagementSelectorEventRegistrationCancelV1
ManagementSelector_event_complete_v1?: ManagementSelectorEventCompleteV1
ManagementSelector_event_duty_verify_v1?: ManagementSelectorEventDutyVerifyV1
ManagementSelector_event_cancel_preview_v1?: ManagementSelectorEventCancelPreviewV1
ManagementSelector_event_cancel_apply_v1?: ManagementSelectorEventCancelApplyV1
ManagementSelector_document_upload_prepare_v1?: ManagementSelectorDocumentUploadPrepareV1
ManagementSelector_document_version_publish_v1?: ManagementSelectorDocumentVersionPublishV1
ManagementSelector_document_accept_v1?: ManagementSelectorDocumentAcceptV1
ManagementSelector_publication_set_v1?: ManagementSelectorPublicationSetV1
ManagementSelector_public_application_submit_v1?: ManagementSelectorPublicApplicationSubmitV1
ManagementSelector_public_application_review_v1?: ManagementSelectorPublicApplicationReviewV1
ManagementSelector_class_assignment_set_v1?: ManagementSelectorClassAssignmentSetV1
ManagementSelector_event_attendance_mark_v1?: ManagementSelectorEventAttendanceMarkV1
ManagementSelector_platform_owner_set_v1?: ManagementSelectorPlatformOwnerSetV1
ManagementSelector_platform_owner_remove_v1?: ManagementSelectorPlatformOwnerRemoveV1
ManagementSelector_center_manager_assign_v1?: ManagementSelectorCenterManagerAssignV1
ManagementSelector_center_manager_revoke_v1?: ManagementSelectorCenterManagerRevokeV1
ManagementSelector_attendance_block_v1?: ManagementSelectorAttendanceBlockV1
ManagementSelector_event_attendance_close_v1?: ManagementSelectorEventAttendanceCloseV1
ManagementSelector_event_attendance_correct_v1?: ManagementSelectorEventAttendanceCorrectV1
ManagementSelector_file_upload_complete_v1?: ManagementSelectorFileUploadCompleteV1
ManagementSelector_negcredit_valuation_set_v1?: ManagementSelectorNegcreditValuationSetV1
ManagementSelector_discipline_save_v1?: ManagementSelectorDisciplineSaveV1
ManagementSelector_center_discipline_set_v1?: ManagementSelectorCenterDisciplineSetV1
ManagementSelector_person_discipline_set_v1?: ManagementSelectorPersonDisciplineSetV1
ManagementSelector_event_registration_preview_v1?: ManagementSelectorEventRegistrationPreviewV1
ManagementSelector_event_payment_prepare_v1?: ManagementSelectorEventPaymentPrepareV1
ManagementSelector_event_actual_start_record_v1?: ManagementSelectorEventActualStartRecordV1
ManagementSelector_event_actual_start_correct_v1?: ManagementSelectorEventActualStartCorrectV1
ManagementSelector_reservation_impact_preview_v1?: ManagementSelectorReservationImpactPreviewV1
ManagementSelector_reservation_impact_apply_v1?: ManagementSelectorReservationImpactApplyV1
ManagementSelector_settlement_request_submit_v1?: ManagementSelectorSettlementRequestSubmitV1
ManagementSelector_settlement_request_withdraw_v1?: ManagementSelectorSettlementRequestWithdrawV1
ManagementSelector_settlement_request_decide_v1?: ManagementSelectorSettlementRequestDecideV1
ManagementSelector?: ManagementSelector
ManagementStatePage?: ManagementStatePage
Target_center_update_identified?: TargetCenterUpdateIdentified
ValidityProtectionChange?: ValidityProtectionChange
SettlementPaymentProposal?: SettlementPaymentProposal
SettlementOffsetProposal?: SettlementOffsetProposal
SettlementCorrectionProposal?: SettlementCorrectionProposal
SettlementProposal?: SettlementProposal
SettlementRecordView?: SettlementRecordView
SettlementCenterGrantView?: SettlementCenterGrantView
SettlementAuthorityView?: SettlementAuthorityView
Request_settlement_authority_get?: RequestSettlementAuthorityGet
Request_settlement_delegation_set?: RequestSettlementDelegationSet
Request_settlement_authority_set?: RequestSettlementAuthoritySet
Success_settlement_authority_get?: SuccessSettlementAuthorityGet
Success_settlement_delegation_set?: SuccessSettlementDelegationSet
Success_settlement_authority_set?: SuccessSettlementAuthoritySet
ManagementSelector_settlement_delegation_set_v1?: ManagementSelectorSettlementDelegationSetV1
ManagementProjection_settlement_delegation_set_v1?: ManagementProjectionSettlementDelegationSetV1
ManagementSelector_settlement_authority_set_v1?: ManagementSelectorSettlementAuthoritySetV1
ManagementProjection_settlement_authority_set_v1?: ManagementProjectionSettlementAuthoritySetV1
SettlementCorrectionAllocation?: SettlementCorrectionAllocation
SettlementRecordAllocationView?: SettlementRecordAllocationView
SettlementSubmitAuthority?: SettlementSubmitAuthority
SettlementDecisionAuthority?: SettlementDecisionAuthority
Request_negative_limits_get?: RequestNegativeLimitsGet
NegativeLimitsView?: NegativeLimitsView
Success_negative_limits_get?: SuccessNegativeLimitsGet
LessonLimitSnapshot?: LessonLimitSnapshot
LessonPolicyVersions?: LessonPolicyVersions
LessonBookingObligation?: LessonBookingObligation
LessonAttendanceTerms?: LessonAttendanceTerms
LessonFinancialSnapshot?: LessonFinancialSnapshot
LessonRightTransition?: LessonRightTransition
LessonAttendanceEffect?: LessonAttendanceEffect
ExactMinorBasis?: ExactMinorBasis
LessonEarningParticipant?: LessonEarningParticipant
LessonEarningSnapshot?: LessonEarningSnapshot
AgreementValidity?: AgreementValidity
LessonStartedAgreement?: LessonStartedAgreement
Request_attendance_start?: RequestAttendanceStart
Success_attendance_start?: SuccessAttendanceStart
ManagementSelector_attendance_start_v1?: ManagementSelectorAttendanceStartV1
ManagementProjection_attendance_start_v1?: ManagementProjectionAttendanceStartV1
LessonRequestView?: LessonRequestView
LessonRequestAlternativeView?: LessonRequestAlternativeView
SeatOfferView?: SeatOfferView
WaitlistEntryView?: WaitlistEntryView
SaleRefundQuote?: SaleRefundQuote
SaleLifecyclePreviewDetails?: SaleLifecyclePreviewDetails
P03PaymentCorrectionView?: P03PaymentCorrectionView
P03PaymentView?: P03PaymentView
SignedMoney?: SignedMoney
PublicPublicationDetails?: PublicPublicationDetails
TrialOfferTerms?: TrialOfferTerms
CrmFollowupView?: CrmFollowupView
Page_CrmFollowupView?: Page_CrmFollowupView
Request_document_publication_preview?: RequestDocumentPublicationPreview
DocumentImpactApproval?: DocumentImpactApproval
DocumentPublicationAffected?: DocumentPublicationAffected
Success_document_publication_preview?: SuccessDocumentPublicationPreview
ManagementSelector_document_publication_preview_v1?: ManagementSelectorDocumentPublicationPreviewV1
ManagementProjection_document_publication_preview_v1?: ManagementProjectionDocumentPublicationPreviewV1
ReportRatioBps?: ReportRatioBps
ImportMoneyTotal?: ImportMoneyTotal
ImportPreviewSummary?: ImportPreviewSummary
LifecycleImpact?: LifecycleImpact
PrivacyProgress?: PrivacyProgress
SettingsScope?: SettingsScope
SettingsVersion?: SettingsVersion
UserSettingsValues?: UserSettingsValues
MemberSettingsValues?: MemberSettingsValues
CenterSettingsValues?: CenterSettingsValues
OrganizationSettingsValues?: OrganizationSettingsValues
PlatformSettingsValues?: PlatformSettingsValues
SettingsView?: SettingsView
SettingsFieldKeys?: SettingsFieldKeys
SettingsResetPreview?: SettingsResetPreview
SettingsHistoryItem?: SettingsHistoryItem
SettingsHistory?: SettingsHistory
SettingsFieldDescriptor?: SettingsFieldDescriptor
SettingsCatalog?: SettingsCatalog
Request_settings_catalog_get?: RequestSettingsCatalogGet
Success_settings_catalog_get?: SuccessSettingsCatalogGet
Request_settings_get?: RequestSettingsGet
Success_settings_get?: SuccessSettingsGet
Request_settings_update?: RequestSettingsUpdate
Success_settings_update?: SuccessSettingsUpdate
Request_settings_reset_preview?: RequestSettingsResetPreview
Success_settings_reset_preview?: SuccessSettingsResetPreview
Request_settings_reset_apply?: RequestSettingsResetApply
Success_settings_reset_apply?: SuccessSettingsResetApply
Request_settings_history_get?: RequestSettingsHistoryGet
Success_settings_history_get?: SuccessSettingsHistoryGet
ManagementSelector_settings_update_v1?: ManagementSelectorSettingsUpdateV1
ManagementSelector_settings_reset_preview_v1?: ManagementSelectorSettingsResetPreviewV1
ManagementSelector_settings_reset_apply_v1?: ManagementSelectorSettingsResetApplyV1
BookingCategory?: BookingCategory
CategoryCapacities?: CategoryCapacities
SessionCapacity?: SessionCapacity
Request_reservation_capacity_override?: RequestReservationCapacityOverride
Success_reservation_capacity_override?: SuccessReservationCapacityOverride
ManagementProjection_reservation_capacity_override_v1?: ManagementProjectionReservationCapacityOverrideV1
ManagementSelector_reservation_capacity_override_v1?: ManagementSelectorReservationCapacityOverrideV1
SessionCapacityView?: SessionCapacityView
AccountSessionView?: AccountSessionView
AccountSecurityEvent?: AccountSecurityEvent
AccountSessionPage?: AccountSessionPage
AccountSecurityHistory?: AccountSecurityHistory
AccountSessionRevocation?: AccountSessionRevocation
Request_account_sessions_list?: RequestAccountSessionsList
Success_account_sessions_list?: SuccessAccountSessionsList
Request_account_session_label?: RequestAccountSessionLabel
Success_account_session_label?: SuccessAccountSessionLabel
Request_account_sessions_revoke?: RequestAccountSessionsRevoke
Success_account_sessions_revoke?: SuccessAccountSessionsRevoke
Request_account_security_history_get?: RequestAccountSecurityHistoryGet
Success_account_security_history_get?: SuccessAccountSecurityHistoryGet
Request_account_totp_remove?: RequestAccountTotpRemove
AccountTotpRemoval?: AccountTotpRemoval
Success_account_totp_remove?: SuccessAccountTotpRemove
AccountIdentityView?: AccountIdentityView
Request_account_google_link_prepare?: RequestAccountGoogleLinkPrepare
GoogleLinkAuthorization?: GoogleLinkAuthorization
Success_account_google_link_prepare?: SuccessAccountGoogleLinkPrepare
StarterRetainedScope?: StarterRetainedScope
StarterScopeSelection?: StarterScopeSelection
SharedLessonParticipant?: SharedLessonParticipant
SettingsImageUpload?: SettingsImageUpload
SettingsMediaAsset?: SettingsMediaAsset
SettingsMediaChange?: SettingsMediaChange
Request_media_get?: RequestMediaGet
SettingsMediaContent?: SettingsMediaContent
Success_media_get?: SuccessMediaGet
ReportColumns?: ReportColumns
ReportPreparationOrder?: ReportPreparationOrder
ReportPreparationGrouping?: ReportPreparationGrouping
WorkTemplateReference?: WorkTemplateReference
StarterReportTemplate?: StarterReportTemplate
StarterImportTemplate?: StarterImportTemplate
WorkTemplates?: WorkTemplates
ReportFilterOverrides?: ReportFilterOverrides
ReportTemplateOverrides?: ReportTemplateOverrides
ImportTemplateOverrides?: ImportTemplateOverrides
Request_settings_template_resolve?: RequestSettingsTemplateResolve
PreparedReportRequest?: PreparedReportRequest
PreparedImportRequest?: PreparedImportRequest
ResolvedWorkTemplate?: ResolvedWorkTemplate
Success_settings_template_resolve?: SuccessSettingsTemplateResolve
PublicBusinessProfile?: PublicBusinessProfile
ManualCollectionPayment?: ManualCollectionPayment
PersonalCalendarLink?: PersonalCalendarLink
PersonalCalendarMutation?: PersonalCalendarMutation
PersonalCalendarCredentialMutation?: PersonalCalendarCredentialMutation
Page_PersonalCalendarLink?: Page_PersonalCalendarLink
Request_calendar_links_get?: RequestCalendarLinksGet
Request_calendar_link_create?: RequestCalendarLinkCreate
Request_calendar_link_rotate?: RequestCalendarLinkRotate
Request_calendar_link_revoke?: RequestCalendarLinkRevoke
Request_calendar_feed_get?: RequestCalendarFeedGet
PersonalCalendarFeed?: PersonalCalendarFeed
Success_calendar_links_get?: SuccessCalendarLinksGet
Success_calendar_link_create?: SuccessCalendarLinkCreate
Success_calendar_link_rotate?: SuccessCalendarLinkRotate
Success_calendar_link_revoke?: SuccessCalendarLinkRevoke
Success_calendar_feed_get?: SuccessCalendarFeedGet
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Interval".
 */
export interface Interval {
starts_at: Instant
ends_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DateInterval".
 */
export interface DateInterval {
start_date: Date
end_date: Date
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Capacity".
 */
export interface Capacity {
nominal: Count
maximum: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ConfigurationScope".
 */
export interface ConfigurationScope {
kind: ConfigurationScopeKind
center_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RoleScope".
 */
export interface RoleScope {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RoomCapacity".
 */
export interface RoomCapacity {
nominal: Count
maximum: Count
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CenterCreate".
 */
export interface CenterCreate {
name: Text
timezone: IanaZone
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ContactInput".
 */
export interface ContactInput {
kind: ContactKind
value: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonPatch".
 */
export interface PersonPatch {
display_name?: Text
contacts?: ContactInput[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ResourceRef".
 */
export interface ResourceRef {
kind: ResourceKind
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AvailabilityRule".
 */
export interface AvailabilityRule {
/**
 * @minItems 1
 */
weekdays: [number, ...(number)[]]
local_start: LocalTime
local_end: LocalTime
valid_from: Date
valid_until?: (Date | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DutyInput".
 */
export interface DutyInput {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
agreement_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ProgramSpec".
 */
export interface ProgramSpec {
/**
 * @minItems 1
 */
weekdays: [number, ...(number)[]]
local_start: LocalTime
duration_minutes?: PositiveInt
starts_on: Date
ends_on: Date
room_id?: (string | null)
assignments: DutyInput[]
capacity: SessionCapacity
offset_choices?: LocalOffsetChoice[]
inherit_class_assignments?: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionCapacity".
 */
export interface SessionCapacity {
total: Count
categories?: (CategoryCapacities | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CategoryCapacities".
 */
export interface CategoryCapacities {
male: Count
female: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LocalOffsetChoice".
 */
export interface LocalOffsetChoice {
date: Date
offset_minutes: number
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionCreate".
 */
export interface SessionCreate {
class_id?: (string | null)
interval: Interval
format: SessionFormat
resources: ResourceRef[]
assignments: DutyInput[]
capacity: SessionCapacity
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionPatch".
 */
export interface SessionPatch {
interval?: Interval
resources?: ResourceRef[]
assignments?: DutyInput[]
capacity?: SessionCapacity
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RequestAlternative".
 */
export interface RequestAlternative {
interval: Interval
instructor_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SubjectRef".
 */
export interface SubjectRef {
type: EntityType
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EntityRef".
 */
export interface EntityRef {
type: EntityType
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EntityVersion".
 */
export interface EntityVersion {
entity: EntityRef
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PreviewToken".
 */
export interface PreviewToken {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CashCorrection".
 */
export interface CashCorrection {
amount_minor: PositiveMoney
currency: Currency
occurred_at: Instant
direction: Direction
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AttendanceCorrection".
 */
export interface AttendanceCorrection {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
result: AttendanceResult
reason?: (BlockReason | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "QuotaSpec".
 */
export interface QuotaSpec {
period: ("week" | "month")
limit: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FreezeTerms".
 */
export interface FreezeTerms {
enabled: Bool
extends_validity: Bool
max_days?: (PositiveInt | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RefundTerms".
 */
export interface RefundTerms {
method: RefundMethod
used_unit_minor?: (Money | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ProductTerms".
 */
export interface ProductTerms {
name: Text
kind: EntitlementKind
booking_mode: BookingMode
credits?: (PositiveInt | null)
price_minor: Money
currency: Currency
freeze: FreezeTerms
refund: RefundTerms
quota?: (QuotaSpec | null)
/**
 * @minItems 1
 */
scopes: [ProductScope, ...(ProductScope)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ValuationBasis".
 */
export interface ValuationBasis {
mode: CurrencyBasis
unit_minor?: (Money | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PayComponent".
 */
export interface PayComponent {
kind: ("percentage" | "session_fixed" | "per_person")
rate_bps?: (RateBps | null)
amount_minor?: (Money | null)
entitlement_kind?: (EntitlementKind | null)
basis?: (ValuationBasis | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RoomFee".
 */
export interface RoomFee {
kind: ("free" | "fixed" | "percentage")
amount_minor?: (Money | null)
rate_bps?: (RateBps | null)
basis?: (ValuationBasis | null)
order: ("before_instructor_share" | "after_instructor_share")
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PayTerms".
 */
export interface PayTerms {
model: PayModel
currency: Currency
/**
 * @minItems 1
 */
components: [PayComponent, ...(PayComponent)[]]
room_fee: RoomFee
/**
 * @minItems 0
 */
package_overrides?: AgreementPackageTerms[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AgreementPackageTerms".
 */
export interface AgreementPackageTerms {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_id: string
/**
 * @minItems 1
 */
components: [PayComponent, ...(PayComponent)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "VenueSpec".
 */
export interface VenueSpec {
kind: ("internal" | "external")
room_id?: (string | null)
name?: (Text | null)
address?: (Text | null)
latitude?: (number | null)
longitude?: (number | null)
timezone: IanaZone
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventDutyInput".
 */
export interface EventDutyInput {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
fee_minor: Money
currency: Currency
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CancellationTerms".
 */
export interface CancellationTerms {
cutoff_minutes?: (Count | null)
before_cutoff: ("release" | "consume")
after_cutoff: ("release" | "consume")
no_show: ("release" | "consume")
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventTerms".
 */
export interface EventTerms {
fee_minor: Money
currency: Currency
full_payment_required: Bool
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
allowed_product_version_ids: string[]
cancellation: CancellationTerms
refund: RefundTerms
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentRequirement".
 */
export interface DocumentRequirement {
gate: DocumentGate
scope: DocumentScope
renewed_acceptance: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentScope".
 */
export interface DocumentScope {
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_ids?: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_ids?: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_ids?: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_ids?: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AcceptanceContext".
 */
export interface AcceptanceContext {
gate: DocumentGate
subject: EntityRef
on_behalf_of_person_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id?: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SegmentCondition".
 */
export interface SegmentCondition {
field: ("last_attended_at" | "entitlement_ends_at" | "remaining_credits" | "lead_source" | "lead_interest" | "active_student" | "center_id")
operator: ("eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "is_null")
value?: (string | number | boolean | string[])
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SegmentDefinition".
 */
export interface SegmentDefinition {
all?: SegmentCondition[]
any?: SegmentCondition[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AutomationTrigger".
 */
export interface AutomationTrigger {
kind: ("entitlement_expiring" | "student_inactive" | "lead_followup_due")
offset_days: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AutomationAction".
 */
export interface AutomationAction {
kind: ("create_followup" | "send_reminder")
channel: NotificationChannel
template_key: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AutomationDefinition".
 */
export interface AutomationDefinition {
name: Text
segment_id?: (string | null)
trigger: AutomationTrigger
action: AutomationAction
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
execution_center_ids: string[]
enabled: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportColumn".
 */
export interface ImportColumn {
source_column: Text
target: ImportTarget
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportMapping".
 */
export interface ImportMapping {
columns: ImportColumn[]
delimiter?: ("," | ";")
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportRow".
 */
export interface ImportRow {
source_key: Text
display_name: Text
email?: (Text | null)
phone?: (Text | null)
person_ref?: (string | null)
opening_credits?: (Count | null)
opening_debt_minor?: (Money | null)
currency?: (Currency | null)
product_version_ref?: (string | null)
start_date?: (Date | null)
end_date?: (Date | null)
opening_credit_value_minor?: (Money | null)
/**
 * @maxItems 100
 */
contacts?: {
kind: ("email" | "phone")
value: Text
}[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportFilters".
 */
export interface ReportFilters {
interval: Interval
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_ids: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_ids?: string[]
currency?: (Currency | null)
state?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page".
 */
export interface Page {
limit?: number
cursor?: (OpaqueToken | null)
sort?: ("created_at_asc" | "created_at_desc" | "starts_at_asc" | "display_name_asc" | "due_at_asc")
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "IntegerPolicy".
 */
export interface IntegerPolicy {
kind: "integer"
value: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "BooleanPolicy".
 */
export interface BooleanPolicy {
kind: "boolean"
value: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "WindowPolicy".
 */
export interface WindowPolicy {
kind: "window"
opens_minutes_before: Count
closes_minutes_before: Count
manager_exception: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CancellationPolicy".
 */
export interface CancellationPolicy {
kind: "cancellation"
terms: CancellationTerms
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "BlockCreditPolicy".
 */
export interface BlockCreditPolicy {
kind: "blocked_credit"
effect: ("release" | "consume")
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NegativeValuationPolicy".
 */
export interface NegativeValuationPolicy {
kind: "valuation"
format: SessionFormat
amount_minor: Money
currency: Currency
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentPolicy".
 */
export interface DocumentPolicy {
kind: "documents"
requirements: DocumentRequirement[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PolicyVersionInput".
 */
export interface PolicyVersionInput {
key: PolicyKey
value: PolicyValue
scope: ConfigurationScope
effective_at: Instant
mandatory: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SafeError".
 */
export interface SafeError {
code: ("AUTH_REQUIRED" | "SESSION_REVOKED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_FAILED" | "CLIENT_UPDATE_REQUIRED" | "PLAN_FEATURE_UNAVAILABLE" | "PLAN_LIMIT_REACHED" | "SERVICE_UNAVAILABLE" | "BILLING_OPERATION_RESTRICTED" | "POLICY_NOT_CONFIGURED" | "CAPACITY_FULL" | "RESOURCE_CONFLICT" | "RESERVATION_EXISTS" | "ENTITLEMENT_UNAVAILABLE" | "CREDIT_LIMIT_EXCEEDED" | "QUOTA_EXCEEDED" | "CLASS_ACCESS_DENIED" | "DOCUMENT_REQUIRED" | "ATTENDANCE_INCOMPLETE" | "ATTENDANCE_CLOSED" | "ASSISTANT_PARTICIPANT_CONFLICT" | "OPEN_OPERATIONS_EXIST" | "VERSION_CONFLICT" | "PREVIEW_STALE" | "APPROVAL_REQUIRED" | "ACCOUNT_LINK_CONFLICT" | "OWNER_TRANSFER_REQUIRED" | "INVALID_STATE_TRANSITION" | "INVITATION_UNAVAILABLE" | "OFFER_UNAVAILABLE" | "INSUFFICIENT_STUDENT_CREDIT" | "CURRENCY_MISMATCH" | "IDEMPOTENCY_PAYLOAD_MISMATCH" | "OPERATION_IN_PROGRESS" | "OPERATION_RESULT_EXPIRED" | "RATE_LIMITED" | "BOT_VERIFICATION_FAILED" | "TEMPORARY_FAILURE" | "INTEGRITY_VIOLATION" | "RESULT_NOT_CONFIRMED" | "ACCOUNT_ALREADY_LINKED" | "ACCOUNT_LINK_REQUIRED" | "SUBSCRIPTION_NOT_STARTED" | "PARTICIPATION_BLOCKED")
retryable: Bool
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
retry_after_ms?: Count
field_paths?: Text[]
}
/**
 * Q-E02: reverse is a full linked entitlement-consumption reversal, never an automatic cash refund.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Effect".
 */
export interface Effect {
entity: EntityRef
action: ("create" | "cancel" | "reserve" | "consume" | "release" | "adjust" | "close" | "unlink" | "delete" | "reverse")
quantity?: (Count | null)
amount_minor?: (Money | null)
currency?: (Currency | null)
reason?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PreviewDependencies".
 */
export interface PreviewDependencies {
versions: EntityVersion[]
policy_hashes: Text[]
permission_hash: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PreviewResult".
 */
export interface PreviewResult {
effects: Effect[]
blockers: SafeError[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Preview".
 */
export interface Preview {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
token: OpaqueToken
scope_hash: Text
dependencies: PreviewDependencies
effects: Effect[]
blockers: SafeError[]
expires_at: Instant
sessions?: SchedulePreviewItem[]
class_assignments?: ClassAssignmentView[]
class_version?: PositiveInt
sale_lifecycle?: SaleLifecyclePreviewDetails
import_summary?: ImportPreviewSummary
merge_summary?: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
source_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_id: string
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
affected_center_ids: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
required_approval_center_ids: string[]
linked_history: true
}
lifecycle_impact?: LifecycleImpact
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SchedulePreviewItem".
 */
export interface SchedulePreviewItem {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
expected_version?: PositiveInt
interval: Interval
resources: ResourceRef[]
assignments: DutyInput[]
capacity: SessionCapacity
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ClassAssignmentView".
 */
export interface ClassAssignmentView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
state: RecordState
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SaleLifecyclePreviewDetails".
 */
export interface SaleLifecyclePreviewDetails {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
previous_sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
start_date: Date
end_date: Date
previous_end_date: Date
gap_days: Count
overlap_days: Count
refund: (SaleRefundQuote | null)
offset_minor: Money
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SaleRefundQuote".
 */
export interface SaleRefundQuote {
method: RefundMethod
calculated_minor: Money
debt_reduction_minor: Money
credit_added_minor: Money
currency: Currency
consumed: Count
unused: Count
paid_days: Count
debts: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
reduction_minor: Money
}[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportPreviewSummary".
 */
export interface ImportPreviewSummary {
total_rows: Count
valid_rows: Count
invalid_rows: Count
new_people: Count
replayed_rows: Count
opening_credits: Count
existing_negative_credits: Count
opening_debt_totals: ImportMoneyTotal[]
original_credit_basis_totals: ImportMoneyTotal[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportMoneyTotal".
 */
export interface ImportMoneyTotal {
currency: Currency
amount_minor: Money
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LifecycleImpact".
 */
export interface LifecycleImpact {
active_account_links: Count
open_sessions: Count
open_requests: Count
active_reservations: Count
active_event_registrations: Count
open_debts: Count
student_credit_accounts: Count
export_operation: "report_export_start_v1"
export_requires_scope_check: true
export_before_closure: true
physical_erasure_complete: false
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Mutation".
 */
export interface Mutation {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
primary_id: string
version?: PositiveInt
replayed: Bool
related: EntityRef[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "JobRef".
 */
export interface JobRef {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
state: JobState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DownloadRef".
 */
export interface DownloadRef {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
download_path: Text
expires_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "UploadRef".
 */
export interface UploadRef {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
upload_url: OpaqueToken
expires_at: Instant
allowed_mime: Text[]
max_bytes: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "GenericAccepted".
 */
export interface GenericAccepted {
accepted: true
reference?: OpaqueToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "WorkerResult".
 */
export interface WorkerResult {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
state: JobState
result_reference?: EntityRef
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ContactView".
 */
export interface ContactView {
kind: ContactKind
value: Text
verified_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountView".
 */
export interface AccountView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
state: AccountState
display_name: Text
/**
 * @maxItems 20
 */
profile_notices?: []|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]|[{
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}, {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: "account_profile_updated"
created_at: Instant
}]
identity?: AccountIdentityView
photo?: (SettingsMediaAsset | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountIdentityView".
 */
export interface AccountIdentityView {
given_name: (string | null)
family_name: (string | null)
email: (string | null)
phone: (string | null)
pending_email: (string | null)
pending_phone: (string | null)
email_verified_at: (Instant | null)
phone_verified_at: (Instant | null)
unverified_phone: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsMediaAsset".
 */
export interface SettingsMediaAsset {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
mime: ("image/png" | "image/jpeg" | "image/webp")
bytes: number
checksum: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OrganizationView".
 */
export interface OrganizationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
name: Text
state: OrganizationState
access_mode: ("bootstrap" | "normal" | "grace" | "closed")
version: PositiveInt
logo?: (SettingsMediaAsset | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CenterView".
 */
export interface CenterView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
name: Text
timezone: IanaZone
state: RecordState
accessible: Bool
version: PositiveInt
organization_logo?: (SettingsMediaAsset | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RoleView".
 */
export interface RoleView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
role: Role
scope_center_id: (string | null)
state: RecordState
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PolicyView".
 */
export interface PolicyView {
key: PolicyKey
scope: ConfigurationScope
value: PolicyValue
effective_at: Instant
mandatory: Bool
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "RelationshipView".
 */
export interface RelationshipView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
kind: RelationshipKind
state: RelationshipState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonSummary".
 */
export interface PersonSummary {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
display_name: Text
relationships: RelationshipView[]
contacts?: ContactView[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
linked_person_ids?: string[]
given_name?: (string | null)
family_name?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonView".
 */
export interface PersonView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
display_name: Text
relationships: RelationshipView[]
contacts?: ContactView[]
version: PositiveInt
discipline_relationships: DisciplineRelationshipView[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
linked_person_ids?: string[]
given_name?: (string | null)
family_name?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DisciplineRelationshipView".
 */
export interface DisciplineRelationshipView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
kind: DisciplineRelationshipKind
state: RelationshipState
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionCapacityView".
 */
export interface SessionCapacityView {
total: Count
categories?: (CategoryCapacities | null)
held: Count
remaining: Count
category_held: (CategoryCapacities | null)
category_remaining: (CategoryCapacities | null)
room_capacity: (Count | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SessionView".
 */
export interface SessionView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
class_id: (string | null)
format: SessionFormat
starts_at: Instant
ends_at: Instant
state: SessionState
attendance_state: AttendanceClosure
assignments: DutyInput[]
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
class_assignments?: ClassAssignmentView[]
class_version?: PositiveInt
capacity: SessionCapacityView
shared_participants?: SharedLessonParticipant[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SharedLessonParticipant".
 */
export interface SharedLessonParticipant {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
display_name?: string
email?: string
phone?: string
photo?: SettingsMediaAsset
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReservationView".
 */
export interface ReservationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
state: ReservationState
mode: BookingMode
version: PositiveInt
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AttendanceEntryView".
 */
export interface AttendanceEntryView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
result: AttendanceResult
blocked_reason?: BlockReason
version: PositiveInt
protected: Bool
eligibility_snapshot: (EligibilitySnapshot | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EligibilitySnapshot".
 */
export interface EligibilitySnapshot {
evaluated_for: Instant
limit: (Count | null)
reserved_deficit: Count
consumed_deficit: Count
this_reservation_counted: Bool
eligible: Bool
reason: (BlockReason | null)
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
policy_version_ids: string[]
evidence_hash: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AttendanceView".
 */
export interface AttendanceView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
closure_state: AttendanceClosure
revision: Count
entries: AttendanceEntryView[]
session_version: PositiveInt
actual_started_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ProductView".
 */
export interface ProductView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
version_id: string
terms: ProductTerms
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "QuotaView".
 */
export interface QuotaView {
starts_at: Instant
ends_at: Instant
limit: Count
reserved: Count
consumed: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EntitlementView".
 */
export interface EntitlementView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
start_date: Date
end_date: Date
timezone: IanaZone
state: EntitlementState
available: Count
reserved: Count
consumed: Count
deficit: Count
quotas: QuotaView[]
deficit_scopes: DeficitScopeView[]
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id?: string
booking_mode?: BookingMode
kind?: EntitlementKind
available_at_session?: Count
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
account_id?: string
sale_version?: PositiveInt
sale_state?: SaleState
freezes?: TableFreezes[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DeficitScopeView".
 */
export interface DeficitScopeView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
reserved: Count
consumed: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_freezes".
 */
export interface TableFreezes {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
starts_at: Instant
planned_end: Instant
actual_end?: (Instant | null)
state: FreezeState
extension_until?: (Instant | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DebtSummary".
 */
export interface DebtSummary {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
due_at: Instant
remaining_minor: Money
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
version?: PositiveInt
net_minor?: Money
paid_minor?: Money
claimed_minor?: Money
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CashSummary".
 */
export interface CashSummary {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: CashMove
amount_minor: Money
currency: Currency
occurred_at: Instant
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id?: string
version?: PositiveInt
previous_id?: (string | null)
payment?: (ManualCollectionPayment | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FinanceView".
 */
export interface FinanceView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
currency: Currency
debts: DebtSummary[]
credit_available_minor: Money
movements: Page_CashSummary
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_CashSummary".
 */
export interface Page_CashSummary {
items: CashSummary[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EarningBasis".
 */
export interface EarningBasis {
source: ("sale_unit" | "negative_snapshot" | "agreement_fixed" | "event_fee" | "lesson_agreement")
sale_id?: (string | null)
unit_minor?: (Money | null)
currency: Currency
quantity: Count
excluded_blocked: Count
agreement_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EarningView".
 */
export interface EarningView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
session_id: (string | null)
event_assignment_id: (string | null)
amount_minor: Money
currency: Currency
paid_minor: Money
remaining_minor: Money
basis: EarningBasis
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
direction: EarningDirection
previous_id: (string | null)
closure_id: (string | null)
created_at: Instant
version: PositiveInt
overpaid_minor?: Money
payments?: P03PaymentView[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "P03PaymentView".
 */
export interface P03PaymentView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
version: PositiveInt
amount_minor: Money
net_minor: Money
currency: Currency
occurred_at: Instant
corrections: P03PaymentCorrectionView[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "P03PaymentCorrectionView".
 */
export interface P03PaymentCorrectionView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
previous_id: string
direction: Direction
amount_minor: Money
occurred_at: Instant
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LeadView".
 */
export interface LeadView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
source: Text
interest: Text
assigned_to: (string | null)
state: LeadState
last_contact: (Instant | null)
due_followup: (Instant | null)
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NotificationPayload".
 */
export interface NotificationPayload {
template_key: Text
subject: EntityRef
title?: Text
body?: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NotificationView".
 */
export interface NotificationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
kind: Text
payload: NotificationPayload
created_at: Instant
read_at: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportRow".
 */
export interface ReportRow {
group_key: Text
center_id?: (string | null)
person_id?: (string | null)
currency?: (Currency | null)
count?: (Count | null)
amount_minor?: (Money | null)
credits?: (Count | null)
ratio_bps?: (ReportRatioBps | null)
basis_count?: (Count | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportTotal".
 */
export interface ReportTotal {
currency?: (Currency | null)
count: Count
amount_minor?: (Money | null)
group_key?: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportView".
 */
export interface ReportView {
report_kind: ReportKind
as_of: Instant
filters: ReportFilters
rows: Page_ReportRow
totals: ReportTotal[]
columns?: ReportColumns
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_ReportRow".
 */
export interface Page_ReportRow {
items: ReportRow[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportRowView".
 */
export interface ImportRowView {
row_number: PositiveInt
state: ImportRowState
error_code: (Text | null)
created_references: EntityRef[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "QuoteView".
 */
export interface QuoteView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
from_plan: Plan
to_plan: Plan
period_start: Instant
period_end: Instant
amount_minor: Money
currency: Currency
expires_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PlanLimit".
 */
export interface PlanLimit {
key: ("active_students" | "instructors" | "centers" | "rooms" | "disciplines")
value: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PlanLimits".
 */
export interface PlanLimits {
entries: PlanLimit[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SubscriptionView".
 */
export interface SubscriptionView {
state: SubscriptionState
plan: Plan
period_start: (Instant | null)
period_end: (Instant | null)
grace_until: (Instant | null)
cancel_at_period_end: Bool
pending_change: (EntityRef | null)
limits: PlanLimits
usage: PlanLimits
subscription_version?: PositiveInt
starter_scope?: (StarterScopeSelection | null)
pending_starter_scope?: (StarterScopeSelection | null)
starter_scope_required?: boolean
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "StarterScopeSelection".
 */
export interface StarterScopeSelection {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
scope: StarterRetainedScope
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "StarterRetainedScope".
 */
export interface StarterRetainedScope {
room_id: (string | null)
discipline_id: (string | null)
instructor_id: (string | null)
/**
 * @maxItems 100
 *
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
student_person_ids: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventView".
 */
export interface EventView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
name: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
interval: Interval
timezone: IanaZone
venue: VenueSpec
terms: EventTerms
state: EventState
capacity: Capacity
attendance_state: AttendanceClosure
assignments: DutyInput[]
version: PositiveInt
discipline_ids: EventDisciplineIds
assignment_terms?: EventDutyInput[]
registrations?: EventRegistrationView[]
duties?: EventDutyView[]
actual_started_at?: (Instant | null)
actual_start_history?: ActualStartHistoryItem[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventRegistrationView".
 */
export interface EventRegistrationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
display_name: Text
state: EventRegistrationState
attendance_result: AttendanceResult
version: PositiveInt
participant_cancellation?: (ParticipantCancellationBasis | null)
}
/**
 * Immutable backend decision evidence. Planned start is captured at cancellation; actual occurrence recording never reclassifies it.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ParticipantCancellationBasis".
 */
export interface ParticipantCancellationBasis {
cancelled_at: Instant
planned_starts_at: Instant
phase: ("before_planned_start" | "at_or_after_planned_start")
rule: "planned_start_v1"
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventDutyView".
 */
export interface EventDutyView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
fee_minor: Money
currency: Currency
performed: (Bool | null)
version: PositiveInt
verified_at: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ActualStartHistoryItem".
 */
export interface ActualStartHistoryItem {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
actor_person_id: (string | null)
reason: (Text | null)
diff: (AuditDiff | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AuditDiff".
 */
export interface AuditDiff {
changes: AuditFieldChange[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AuditFieldChange".
 */
export interface AuditFieldChange {
field: Text
old_value: (string | number | boolean | null)
new_value: (string | number | boolean | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentView".
 */
export interface DocumentView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
version_id: string
name: Text
content_hash: Text
required_at: DocumentGate
accepted: Bool
file: EntityRef
content?: {
mime: ("application/pdf" | "text/plain")
encoding: "base64"
data: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PublicCalendarItem".
 */
export interface PublicCalendarItem {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
publication_id: string
title: Text
interval: Interval
venue_public_label: Text
fee_minor: Money
currency: Currency
public_conditions: Text
discipline_ids: EventDisciplineIds
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OperationStatusView".
 */
export interface OperationStatusView {
operation: OperationName
key: OpaqueToken
status: OperationState
result_available: Bool
result_reference: (EntityRef | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "JobStatusView".
 */
export interface JobStatusView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
state: JobState
progress_count: Count
total_count: (Count | null)
result_reference: (EntityRef | null)
safe_error_code: (Text | null)
privacy?: PrivacyProgress
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PrivacyProgress".
 */
export interface PrivacyProgress {
request_state: PrivacyState
completed_at: (Instant | null)
pending_scopes: ("database" | "auth" | "storage" | "exports" | "backups")[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AuditView".
 */
export interface AuditView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
action: OperationName
subject: EntityRef
actor_display: Text
created_at: Instant
reason: (Text | null)
diff: (AuditDiff | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PrivacyScope".
 */
export interface PrivacyScope {
kind: ("account" | "organization")
account_id?: (string | null)
org_id?: (string | null)
all_data: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OperationResult".
 */
export interface OperationResult {
primary: EntityRef
related: EntityRef[]
version?: (PositiveInt | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AuthResult".
 */
export interface AuthResult {
provider: "supabase_auth"
status: ("accepted" | "challenge_required" | "succeeded")
safe_error_code?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SupabaseAuthPasswordRequest".
 */
export interface SupabaseAuthPasswordRequest {
password: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_AccountView".
 */
export interface Page_AccountView {
items: AccountView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_OrganizationView".
 */
export interface Page_OrganizationView {
items: OrganizationView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_CenterView".
 */
export interface Page_CenterView {
items: CenterView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_RoleView".
 */
export interface Page_RoleView {
items: RoleView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_PolicyView".
 */
export interface Page_PolicyView {
items: PolicyView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_PersonSummary".
 */
export interface Page_PersonSummary {
items: PersonSummary[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_PersonView".
 */
export interface Page_PersonView {
items: PersonView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_CalendarItem".
 */
export interface Page_CalendarItem {
items: CalendarItem[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_SessionView".
 */
export interface Page_SessionView {
items: SessionView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_ReservationView".
 */
export interface Page_ReservationView {
items: ReservationView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_AttendanceView".
 */
export interface Page_AttendanceView {
items: AttendanceView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_ProductView".
 */
export interface Page_ProductView {
items: ProductView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_EntitlementView".
 */
export interface Page_EntitlementView {
items: EntitlementView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_FinanceView".
 */
export interface Page_FinanceView {
items: FinanceView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_EarningView".
 */
export interface Page_EarningView {
items: EarningView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_LeadView".
 */
export interface Page_LeadView {
items: LeadView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_NotificationView".
 */
export interface Page_NotificationView {
items: NotificationView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_ReportView".
 */
export interface Page_ReportView {
items: ReportView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_ImportRowView".
 */
export interface Page_ImportRowView {
items: ImportRowView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_QuoteView".
 */
export interface Page_QuoteView {
items: QuoteView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_SubscriptionView".
 */
export interface Page_SubscriptionView {
items: SubscriptionView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_EventView".
 */
export interface Page_EventView {
items: EventView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_DocumentView".
 */
export interface Page_DocumentView {
items: DocumentView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_PublicCalendarItem".
 */
export interface Page_PublicCalendarItem {
items: PublicCalendarItem[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
organization_profile?: (PublicBusinessProfile | null)
center_profile?: (PublicBusinessProfile | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PublicBusinessProfile".
 */
export interface PublicBusinessProfile {
name?: string
description?: string
address?: string
contact?: {
phone: string
email: (string | null)
}
/**
 * @maxItems 100
 */
hours?: {
/**
 * @minItems 1
 * @maxItems 7
 */
weekdays: [number]|[number, number]|[number, number, number]|[number, number, number, number]|[number, number, number, number, number]|[number, number, number, number, number, number]|[number, number, number, number, number, number, number]
local_start: string
local_end: string
timezone: string
}[]
timezone?: string
logo?: (SettingsMediaContent | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsMediaContent".
 */
export interface SettingsMediaContent {
asset: SettingsMediaAsset
data_base64: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_OperationStatusView".
 */
export interface Page_OperationStatusView {
items: OperationStatusView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_JobStatusView".
 */
export interface Page_JobStatusView {
items: JobStatusView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_AuditView".
 */
export interface Page_AuditView {
items: AuditView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_get".
 */
export interface RequestAccountGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_get".
 */
export interface SuccessAccountGet {
ok: true
data: AccountView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_profile_update".
 */
export interface RequestAccountProfileUpdate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
display_name: Text
given_name?: (string | null)
family_name?: (string | null)
unverified_phone?: (string | null)
photo?: (SettingsImageUpload | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsImageUpload".
 */
export interface SettingsImageUpload {
mime: ("image/png" | "image/jpeg" | "image/webp")
data_base64: string
checksum: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_profile_update".
 */
export interface SuccessAccountProfileUpdate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_password_change".
 */
export interface RequestAccountPasswordChange {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_password_change".
 */
export interface SuccessAccountPasswordChange {
ok: true
data: AuthResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_password_reset_request".
 */
export interface RequestAccountPasswordResetRequest {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
email: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_password_reset_request".
 */
export interface SuccessAccountPasswordResetRequest {
ok: true
data: GenericAccepted
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_delete_preview".
 */
export interface RequestAccountDeletePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_delete_preview".
 */
export interface SuccessAccountDeletePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_delete_apply".
 */
export interface RequestAccountDeleteApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
reauth: ReauthProof
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_delete_apply".
 */
export interface SuccessAccountDeleteApply {
ok: true
data: JobRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organizations_list".
 */
export interface RequestOrganizationsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organizations_list".
 */
export interface SuccessOrganizationsList {
ok: true
data: Page_OrganizationView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_create".
 */
export interface RequestOrganizationCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
verified_account_id: string
name: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
initial_plan_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_create".
 */
export interface SuccessOrganizationCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_get".
 */
export interface RequestOrganizationGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_get".
 */
export interface SuccessOrganizationGet {
ok: true
data: OrganizationView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_update".
 */
export interface RequestOrganizationUpdate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
name: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_update".
 */
export interface SuccessOrganizationUpdate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_close_preview".
 */
export interface RequestOrganizationClosePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_close_preview".
 */
export interface SuccessOrganizationClosePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_close_apply".
 */
export interface RequestOrganizationCloseApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_close_apply".
 */
export interface SuccessOrganizationCloseApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_reopen".
 */
export interface RequestOrganizationReopen {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_reopen".
 */
export interface SuccessOrganizationReopen {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_delete_preview".
 */
export interface RequestOrganizationDeletePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
all_data: true
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_delete_preview".
 */
export interface SuccessOrganizationDeletePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_organization_delete_apply".
 */
export interface RequestOrganizationDeleteApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
reauth: ReauthProof
all_data: true
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_organization_delete_apply".
 */
export interface SuccessOrganizationDeleteApply {
ok: true
data: JobRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_centers_list".
 */
export interface RequestCentersList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_centers_list".
 */
export interface SuccessCentersList {
ok: true
data: Page_CenterView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_center_create".
 */
export interface RequestCenterCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
name: Text
timezone: IanaZone
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_center_create".
 */
export interface SuccessCenterCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_center_update".
 */
export interface RequestCenterUpdate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
name: Text
timezone: IanaZone
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_center_update".
 */
export interface SuccessCenterUpdate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_room_save".
 */
export interface RequestRoomSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
room_id?: (string | null)
name: Text
capacity: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_room_save".
 */
export interface SuccessRoomSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_availability_save".
 */
export interface RequestAvailabilitySave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
rule_id?: (string | null)
resource: ResourceRef
rule: AvailabilityRule
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_availability_save".
 */
export interface SuccessAvailabilitySave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_availability_exception_save".
 */
export interface RequestAvailabilityExceptionSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
resource: ResourceRef
interval: Interval
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_availability_exception_save".
 */
export interface SuccessAvailabilityExceptionSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_policies_get".
 */
export interface RequestPoliciesGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
keys: Text[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_policies_get".
 */
export interface SuccessPoliciesGet {
ok: true
data: PolicyView[]
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_policy_publish".
 */
export interface SuccessPolicyPublish {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_roles_list".
 */
export interface RequestRolesList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
person_id?: (string | null)
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_roles_list".
 */
export interface SuccessRolesList {
ok: true
data: Page_RoleView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_role_assign".
 */
export interface RequestRoleAssign {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
role: OperationalRole
scope: RoleScope
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_role_assign".
 */
export interface SuccessRoleAssign {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_role_revoke".
 */
export interface RequestRoleRevoke {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
assignment_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_role_revoke".
 */
export interface SuccessRoleRevoke {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_permission_set".
 */
export interface RequestPermissionSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
permission: Permission
enabled: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_permission_set".
 */
export interface SuccessPermissionSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_org_manager_assign".
 */
export interface RequestOrgManagerAssign {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_org_manager_assign".
 */
export interface SuccessOrgManagerAssign {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_org_manager_revoke".
 */
export interface RequestOrgManagerRevoke {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_org_manager_revoke".
 */
export interface SuccessOrgManagerRevoke {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_manager_self_assign_center".
 */
export interface RequestManagerSelfAssignCenter {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_center_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_manager_self_assign_center".
 */
export interface SuccessManagerSelfAssignCenter {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_access_send".
 */
export interface RequestAccountAccessSend {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_access_send".
 */
export interface SuccessAccountAccessSend {
ok: true
data: JobRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_access_revoke".
 */
export interface RequestAccountAccessRevoke {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
invitation_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_access_revoke".
 */
export interface SuccessAccountAccessRevoke {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_access_accept".
 */
export interface RequestAccountAccessAccept {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_access_accept".
 */
export interface SuccessAccountAccessAccept {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_link_remove".
 */
export interface RequestAccountLinkRemove {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
link_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_link_remove".
 */
export interface SuccessAccountLinkRemove {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_people_list".
 */
export interface RequestPeopleList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
query?: (Text | null)
relationship?: (RelationshipKind | null)
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_people_list".
 */
export interface SuccessPeopleList {
ok: true
data: Page_PersonSummary
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_get".
 */
export interface RequestPersonGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_get".
 */
export interface SuccessPersonGet {
ok: true
data: PersonView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_create".
 */
export interface RequestPersonCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
display_name: Text
contacts: ContactInput[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_create".
 */
export interface SuccessPersonCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_update".
 */
export interface RequestPersonUpdate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
patch: PersonPatch
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_update".
 */
export interface SuccessPersonUpdate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_student_activate".
 */
export interface RequestStudentActivate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_student_activate".
 */
export interface SuccessStudentActivate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_student_deactivate".
 */
export interface RequestStudentDeactivate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_student_deactivate".
 */
export interface SuccessStudentDeactivate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_merge_preview".
 */
export interface RequestPersonMergePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
source_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_merge_preview".
 */
export interface SuccessPersonMergePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_merge_approve".
 */
export interface RequestPersonMergeApprove {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
approval_center_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_merge_approve".
 */
export interface SuccessPersonMergeApprove {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_merge_apply".
 */
export interface RequestPersonMergeApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_merge_apply".
 */
export interface SuccessPersonMergeApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_calendar_get".
 */
export interface RequestCalendarGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
interval: Interval
resource?: (ResourceRef | null)
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_calendar_get".
 */
export interface SuccessCalendarGet {
ok: true
data: Page_CalendarItem
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_class_save".
 */
export interface RequestClassSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
class_id?: (string | null)
name: Text
external_open: Bool
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_class_save".
 */
export interface SuccessClassSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_program_preview".
 */
export interface RequestProgramPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id: string
schedule: ProgramSpec
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_program_preview".
 */
export interface SuccessProgramPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_program_apply".
 */
export interface RequestProgramApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_program_apply".
 */
export interface SuccessProgramApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_create".
 */
export interface RequestSessionCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
class_id?: (string | null)
interval: Interval
resources: ResourceRef[]
assignments: DutyInput[]
capacity: SessionCapacity
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
format: SessionFormat
inherit_class_assignments?: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_create".
 */
export interface SuccessSessionCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_get".
 */
export interface RequestSessionGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_get".
 */
export interface SuccessSessionGet {
ok: true
data: SessionView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_change_preview".
 */
export interface RequestSessionChangePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
patch: SessionPatch
scope: ChangeScope
reason: Text
offset_choices?: LocalOffsetChoice[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_change_preview".
 */
export interface SuccessSessionChangePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_change_apply".
 */
export interface RequestSessionChangeApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_change_apply".
 */
export interface SuccessSessionChangeApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_capacity_set".
 */
export interface RequestSessionCapacitySet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
reason: Text
capacity: SessionCapacity
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_capacity_set".
 */
export interface SuccessSessionCapacitySet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_cancel_preview".
 */
export interface RequestSessionCancelPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_cancel_preview".
 */
export interface SuccessSessionCancelPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_cancel_apply".
 */
export interface RequestSessionCancelApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_cancel_apply".
 */
export interface SuccessSessionCancelApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_replacement_session_create".
 */
export interface RequestReplacementSessionCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
replaces_id: string
interval: Interval
resources: ResourceRef[]
capacity: SessionCapacity
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_replacement_session_create".
 */
export interface SuccessReplacementSessionCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_session_assignment_set".
 */
export interface RequestSessionAssignmentSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
agreement_id?: (string | null)
state?: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_session_assignment_set".
 */
export interface SuccessSessionAssignmentSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lesson_request_create".
 */
export interface SuccessLessonRequestCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lesson_request_withdraw".
 */
export interface RequestLessonRequestWithdraw {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lesson_request_withdraw".
 */
export interface SuccessLessonRequestWithdraw {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lesson_request_reject".
 */
export interface RequestLessonRequestReject {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
reason: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lesson_request_reject".
 */
export interface SuccessLessonRequestReject {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lesson_request_offer_alternative".
 */
export interface SuccessLessonRequestOfferAlternative {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lesson_request_accept_alternative".
 */
export interface SuccessLessonRequestAcceptAlternative {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lesson_request_approve".
 */
export interface RequestLessonRequestApprove {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
session_id?: (string | null)
session?: (SessionCreate | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
expected_version: PositiveInt
booking_category?: BookingCategory
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lesson_request_approve".
 */
export interface SuccessLessonRequestApprove {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reservation_create".
 */
export interface RequestReservationCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
source_sale_id?: (string | null)
mode: BookingMode
booking_category?: BookingCategory
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reservation_create".
 */
export interface SuccessReservationCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reservation_cancel".
 */
export interface RequestReservationCancel {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reservation_cancel".
 */
export interface SuccessReservationCancel {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reservation_list".
 */
export interface RequestReservationList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
person_id?: (string | null)
session_id?: (string | null)
interval?: (Interval | null)
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reservation_list".
 */
export interface SuccessReservationList {
ok: true
data: Page_ReservationView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_waitlist_join".
 */
export interface RequestWaitlistJoin {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
booking_category?: BookingCategory
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_waitlist_join".
 */
export interface SuccessWaitlistJoin {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_waitlist_leave".
 */
export interface RequestWaitlistLeave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
entry_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_waitlist_leave".
 */
export interface SuccessWaitlistLeave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_seat_offer_accept".
 */
export interface RequestSeatOfferAccept {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_seat_offer_accept".
 */
export interface SuccessSeatOfferAccept {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_seat_offer_reject".
 */
export interface RequestSeatOfferReject {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_seat_offer_reject".
 */
export interface SuccessSeatOfferReject {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_get".
 */
export interface RequestAttendanceGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_get".
 */
export interface SuccessAttendanceGet {
ok: true
data: AttendanceView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_mark".
 */
export interface RequestAttendanceMark {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
result: OrdinaryAttendanceResult
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_mark".
 */
export interface SuccessAttendanceMark {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_close".
 */
export interface RequestAttendanceClose {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
performed?: Bool
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
performed_instructor_ids?: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_close".
 */
export interface SuccessAttendanceClose {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_correct_preview".
 */
export interface RequestAttendanceCorrectPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * @minItems 0
 */
corrections: AttendanceCorrection[]
reason: Text
performed?: Bool
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
performed_instructor_ids?: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_correct_preview".
 */
export interface SuccessAttendanceCorrectPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_correct_apply".
 */
export interface RequestAttendanceCorrectApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_correct_apply".
 */
export interface SuccessAttendanceCorrectApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_products_list".
 */
export interface RequestProductsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
page: Page
include_timed_products?: boolean
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_products_list".
 */
export interface SuccessProductsList {
ok: true
data: Page_ProductView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_product_publish".
 */
export interface RequestProductPublish {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
product_id?: (string | null)
terms: ProductTerms
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_product_publish".
 */
export interface SuccessProductPublish {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_preview".
 */
export interface RequestSalePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
start_date: Date
net_minor?: (Money | null)
end_date: Date
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_preview".
 */
export interface SuccessSalePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_apply".
 */
export interface RequestSaleApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_apply".
 */
export interface SuccessSaleApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_entitlements_get".
 */
export interface SuccessEntitlementsGet {
ok: true
data: EntitlementView[]
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_entitlement_extend".
 */
export interface RequestEntitlementExtend {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
end_date: Date
reason: Text
impact_approval: PreviewToken
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_entitlement_extend".
 */
export interface SuccessEntitlementExtend {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_credit_adjust".
 */
export interface RequestCreditAdjust {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
quantity: PositiveInt
direction: Direction
reason: Text
impact_approval: PreviewToken
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_credit_adjust".
 */
export interface SuccessCreditAdjust {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_negative_limit_set".
 */
export interface RequestNegativeLimitSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
allowed_negative_credits: Count
reason: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
impact_approval: PreviewToken
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_negative_limit_set".
 */
export interface SuccessNegativeLimitSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_freeze_preview".
 */
export interface RequestFreezePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
dates: DateInterval
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_freeze_preview".
 */
export interface SuccessFreezePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_freeze_apply".
 */
export interface RequestFreezeApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_freeze_apply".
 */
export interface SuccessFreezeApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_freeze_end_preview".
 */
export interface RequestFreezeEndPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
freeze_id: string
end_date: Date
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_freeze_end_preview".
 */
export interface SuccessFreezeEndPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_freeze_end_apply".
 */
export interface RequestFreezeEndApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_freeze_end_apply".
 */
export interface SuccessFreezeEndApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_terminate_preview".
 */
export interface RequestSaleTerminatePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_terminate_preview".
 */
export interface SuccessSaleTerminatePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_terminate_apply".
 */
export interface RequestSaleTerminateApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_terminate_apply".
 */
export interface SuccessSaleTerminateApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_refund_preview".
 */
export interface RequestSaleRefundPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_refund_preview".
 */
export interface SuccessSaleRefundPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_refund_apply".
 */
export interface RequestSaleRefundApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_refund_apply".
 */
export interface SuccessSaleRefundApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_change_preview".
 */
export interface RequestSaleChangePreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
new_product_version_id: string
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
keep_reservation_ids: string[]
start_date: Date
end_date: Date
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
cancel_reservation_ids: string[]
reason: Text
offset_minor?: Money
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_change_preview".
 */
export interface SuccessSaleChangePreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_change_apply".
 */
export interface RequestSaleChangeApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_change_apply".
 */
export interface SuccessSaleChangeApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_renew_preview".
 */
export interface RequestSaleRenewPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
previous_sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
start_date: Date
end_date: Date
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_renew_preview".
 */
export interface SuccessSaleRenewPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_sale_renew_apply".
 */
export interface RequestSaleRenewApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_sale_renew_apply".
 */
export interface SuccessSaleRenewApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_finance_get".
 */
export interface RequestFinanceGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
currency: Currency
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_finance_get".
 */
export interface SuccessFinanceGet {
ok: true
data: FinanceView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_collection_record".
 */
export interface RequestCollectionRecord {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
amount_minor: PositiveMoney
currency: Currency
occurred_at: Instant
debt_ids?: (string[] | null)
note?: (Text | null)
payment?: ManualCollectionPayment
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_collection_record".
 */
export interface SuccessCollectionRecord {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_collection_correct_preview".
 */
export interface RequestCollectionCorrectPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
cash_movement_id: string
correction: CashCorrection
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_collection_correct_preview".
 */
export interface SuccessCollectionCorrectPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_collection_correct_apply".
 */
export interface RequestCollectionCorrectApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_collection_correct_apply".
 */
export interface SuccessCollectionCorrectApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_student_credit_refund".
 */
export interface RequestStudentCreditRefund {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
amount_minor: PositiveMoney
currency: Currency
occurred_at: Instant
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_student_credit_refund".
 */
export interface SuccessStudentCreditRefund {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_student_credit_offset".
 */
export interface RequestStudentCreditOffset {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
amount_minor: PositiveMoney
currency: Currency
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_student_credit_offset".
 */
export interface SuccessStudentCreditOffset {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_debt_adjust".
 */
export interface RequestDebtAdjust {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
amount_minor: PositiveMoney
direction: Direction
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_debt_adjust".
 */
export interface SuccessDebtAdjust {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_instructor_agreement_publish".
 */
export interface SuccessInstructorAgreementPublish {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_earnings_list".
 */
export interface RequestEarningsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
interval: Interval
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_earnings_list".
 */
export interface SuccessEarningsList {
ok: true
data: Page_EarningView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_instructor_payment_record".
 */
export interface RequestInstructorPaymentRecord {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
earning_ids: string[]
amount_minor: PositiveMoney
currency: Currency
occurred_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_instructor_payment_record".
 */
export interface SuccessInstructorPaymentRecord {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_instructor_payment_correct".
 */
export interface RequestInstructorPaymentCorrect {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id: string
correction: CashCorrection
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_instructor_payment_correct".
 */
export interface SuccessInstructorPaymentCorrect {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_leads_list".
 */
export interface RequestLeadsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
page: Page
query?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_leads_list".
 */
export interface SuccessLeadsList {
ok: true
data: Page_LeadView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lead_save".
 */
export interface RequestLeadSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
lead_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
source: Text
interest: Text
assigned_to?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lead_save".
 */
export interface SuccessLeadSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_crm_activity_save".
 */
export interface SuccessCrmActivitySave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_trial_offer_create".
 */
export interface RequestTrialOfferCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
session_id?: (string | null)
booking_category?: BookingCategory
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_trial_offer_create".
 */
export interface SuccessTrialOfferCreate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_trial_registration_confirm".
 */
export interface RequestTrialRegistrationConfirm {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_trial_registration_confirm".
 */
export interface SuccessTrialRegistrationConfirm {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_lead_convert".
 */
export interface RequestLeadConvert {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_lead_convert".
 */
export interface SuccessLeadConvert {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_crm_followup_list".
 */
export interface RequestCrmFollowupList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
kind: FollowupKind
interval?: (Interval | null)
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_crm_followup_list".
 */
export interface SuccessCrmFollowupList {
ok: true
data: Page_CrmFollowupView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_CrmFollowupView".
 */
export interface Page_CrmFollowupView {
items: CrmFollowupView[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CrmFollowupView".
 */
export interface CrmFollowupView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
lead_id: (string | null)
assigned_to: (string | null)
kind: FollowupKind
due_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_segment_save".
 */
export interface RequestSegmentSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
segment_id?: (string | null)
name: Text
definition: SegmentDefinition
scope: ConfigurationScope
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_segment_save".
 */
export interface SuccessSegmentSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_automation_save".
 */
export interface RequestAutomationSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
automation_id?: (string | null)
definition: AutomationDefinition
scope: ConfigurationScope
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_automation_save".
 */
export interface SuccessAutomationSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_notifications_list".
 */
export interface RequestNotificationsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
page: Page
unread_only: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_notifications_list".
 */
export interface SuccessNotificationsList {
ok: true
data: Page_NotificationView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_notification_mark_read".
 */
export interface RequestNotificationMarkRead {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
notification_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_notification_mark_read".
 */
export interface SuccessNotificationMarkRead {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_notification_preferences_set".
 */
export interface RequestNotificationPreferencesSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
channel: NotificationChannel
purpose: NotificationPurpose
enabled: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_notification_preferences_set".
 */
export interface SuccessNotificationPreferencesSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_report_get".
 */
export interface SuccessReportGet {
ok: true
data: ReportView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_report_export_start".
 */
export interface SuccessReportExportStart {
ok: true
data: JobRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_report_file_get".
 */
export interface RequestReportFileGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_report_file_get".
 */
export interface SuccessReportFileGet {
ok: true
data: DownloadRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_import_upload_prepare".
 */
export interface RequestImportUploadPrepare {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
filename: Text
mime: Text
bytes: Count
checksum: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_import_upload_prepare".
 */
export interface SuccessImportUploadPrepare {
ok: true
data: UploadRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_import_preview".
 */
export interface RequestImportPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
mapping: ImportMapping
source_namespace: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_import_preview".
 */
export interface SuccessImportPreview {
ok: true
data: JobRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_import_apply".
 */
export interface RequestImportApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_import_apply".
 */
export interface SuccessImportApply {
ok: true
data: JobRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_import_rows_list".
 */
export interface RequestImportRowsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_import_rows_list".
 */
export interface SuccessImportRowsList {
ok: true
data: Page_ImportRowView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_subscription_get".
 */
export interface RequestSubscriptionGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_subscription_get".
 */
export interface SuccessSubscriptionGet {
ok: true
data: SubscriptionView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_subscription_upgrade_quote".
 */
export interface RequestSubscriptionUpgradeQuote {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_subscription_upgrade_quote".
 */
export interface SuccessSubscriptionUpgradeQuote {
ok: true
data: QuoteView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_subscription_downgrade_request".
 */
export interface RequestSubscriptionDowngradeRequest {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id: string
kept_center_id?: (string | null)
kept_scope?: StarterRetainedScope
expected_version?: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_subscription_downgrade_request".
 */
export interface SuccessSubscriptionDowngradeRequest {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_subscription_change_cancel".
 */
export interface RequestSubscriptionChangeCancel {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
change_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_subscription_change_cancel".
 */
export interface SuccessSubscriptionChangeCancel {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_subscription_renewal_set".
 */
export interface RequestSubscriptionRenewalSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
renew: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_subscription_renewal_set".
 */
export interface SuccessSubscriptionRenewalSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_saas_payment_submit".
 */
export interface RequestSaasPaymentSubmit {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
amount_minor: Money
currency: Currency
reference: Text
occurred_at: Instant
quote_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_saas_payment_submit".
 */
export interface SuccessSaasPaymentSubmit {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_saas_payment_verify".
 */
export interface RequestSaasPaymentVerify {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id: string
accepted: Bool
reason?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_saas_payment_verify".
 */
export interface SuccessSaasPaymentVerify {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_saas_grace_extend".
 */
export interface RequestSaasGraceExtend {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
until: Instant
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_saas_grace_extend".
 */
export interface SuccessSaasGraceExtend {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_save".
 */
export interface RequestEventSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
event_id?: (string | null)
name: Text
interval: Interval
timezone: IanaZone
venue: VenueSpec
capacity: Capacity
terms: EventTerms
assignments: EventDutyInput[]
discipline_ids: EventDisciplineIds
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_save".
 */
export interface SuccessEventSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_publish".
 */
export interface RequestEventPublish {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
published: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_publish".
 */
export interface SuccessEventPublish {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_register".
 */
export interface SuccessEventRegister {
ok: true
data: EventRegistrationResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventRegistered".
 */
export interface EventRegistered {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
primary_id: string
version?: PositiveInt
replayed: Bool
related: EntityRef[]
outcome: "registered"
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventCapacityClosed".
 */
export interface EventCapacityClosed {
outcome: "capacity_closed"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preparation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
version: PositiveInt
replayed: Bool
remaining_removed_minor: Money
student_credit_added_minor: Money
currency: Currency
}
/**
 * Q-E03: planned start is the monetary cutoff, equality is post-start; no client time override. Existing prestart terms/package terms remain. Q-E02 center settlement unchanged.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_registration_cancel".
 */
export interface RequestEventRegistrationCancel {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_registration_cancel".
 */
export interface SuccessEventRegistrationCancel {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_complete".
 */
export interface RequestEventComplete {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_complete".
 */
export interface SuccessEventComplete {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_duty_verify".
 */
export interface RequestEventDutyVerify {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
assignment_id: string
performed: Bool
reason?: (Text | null)
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_duty_verify".
 */
export interface SuccessEventDutyVerify {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * Q-E02 final acceptance: center cancellation at any stage fully settles only linked event obligations and rights; participant cancellation has no monetary journal effect.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_cancel_preview".
 */
export interface RequestEventCancelPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_cancel_preview".
 */
export interface SuccessEventCancelPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * Q-E02 final acceptance: center cancellation at any stage fully settles only linked event obligations and rights; participant cancellation has no monetary journal effect.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_cancel_apply".
 */
export interface RequestEventCancelApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_cancel_apply".
 */
export interface SuccessEventCancelApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_list".
 */
export interface RequestEventList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
interval: Interval
page: Page
discipline_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_list".
 */
export interface SuccessEventList {
ok: true
data: Page_EventView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_document_upload_prepare".
 */
export interface RequestDocumentUploadPrepare {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
name: Text
mime: Text
bytes: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_document_upload_prepare".
 */
export interface SuccessDocumentUploadPrepare {
ok: true
data: UploadRef
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_document_version_publish".
 */
export interface RequestDocumentVersionPublish {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
document_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
version_label: Text
requirements: DocumentRequirement[]
scope: ConfigurationScope
impact_approval?: DocumentImpactApproval
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentImpactApproval".
 */
export interface DocumentImpactApproval {
preview: PreviewToken
accepted_subjects: EntityRef[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_document_version_publish".
 */
export interface SuccessDocumentVersionPublish {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_document_requirements_get".
 */
export interface RequestDocumentRequirementsGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
context: AcceptanceContext
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
content_file_id?: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_document_requirements_get".
 */
export interface SuccessDocumentRequirementsGet {
ok: true
data: DocumentView[]
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_document_accept".
 */
export interface RequestDocumentAccept {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
document_version_id: string
context: AcceptanceContext
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_document_accept".
 */
export interface SuccessDocumentAccept {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_publication_set".
 */
export interface RequestPublicationSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
session_id?: (string | null)
event_id?: (string | null)
published: Bool
public_details?: PublicPublicationDetails
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PublicPublicationDetails".
 */
export interface PublicPublicationDetails {
title: Text
venue_public_label: Text
fee_minor: Money
currency: Currency
public_conditions: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_publication_set".
 */
export interface SuccessPublicationSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_public_calendar_get".
 */
export interface RequestPublicCalendarGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
center_id?: (string | null)
slug: Text
interval: Interval
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_public_calendar_get".
 */
export interface SuccessPublicCalendarGet {
ok: true
data: Page_PublicCalendarItem
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_public_application_submit".
 */
export interface RequestPublicApplicationSubmit {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
publication_id: string
contact: Text
bot_proof: Secret
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
client_request_key: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_public_application_submit".
 */
export interface SuccessPublicApplicationSubmit {
ok: true
data: GenericAccepted
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_public_application_review".
 */
export interface RequestPublicApplicationReview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
application_id: string
action: ApplicationAction
person_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_public_application_review".
 */
export interface SuccessPublicApplicationReview {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_operation_status_get".
 */
export interface RequestOperationStatusGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
org_id?: (string | null)
operation: OperationName
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
key: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_operation_status_get".
 */
export interface SuccessOperationStatusGet {
ok: true
data: OperationStatusView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_preview_get".
 */
export interface RequestPreviewGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_preview_get".
 */
export interface SuccessPreviewGet {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_job_status_get".
 */
export interface RequestJobStatusGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
org_id: (string | null)
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_job_status_get".
 */
export interface SuccessJobStatusGet {
ok: true
data: JobStatusView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_audit_list".
 */
export interface RequestAuditList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
subject: SubjectRef
interval: Interval
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_audit_list".
 */
export interface SuccessAuditList {
ok: true
data: Page_AuditView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_seat_offer_issue".
 */
export interface RequestSeatOfferIssue {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_seat_offer_issue".
 */
export interface SuccessSeatOfferIssue {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_seat_offer_expire".
 */
export interface RequestSeatOfferExpire {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_seat_offer_expire".
 */
export interface SuccessSeatOfferExpire {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_request_expire".
 */
export interface RequestRequestExpire {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_request_expire".
 */
export interface SuccessRequestExpire {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_outbox_deliver".
 */
export interface RequestOutboxDeliver {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_outbox_deliver".
 */
export interface SuccessOutboxDeliver {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reminder_schedule".
 */
export interface RequestReminderSchedule {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reminder_schedule".
 */
export interface SuccessReminderSchedule {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_automation_run".
 */
export interface RequestAutomationRun {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_automation_run".
 */
export interface SuccessAutomationRun {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_import_rows_process".
 */
export interface RequestImportRowsProcess {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_import_rows_process".
 */
export interface SuccessImportRowsProcess {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_report_build".
 */
export interface RequestReportBuild {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_report_build".
 */
export interface SuccessReportBuild {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_privacy_execute".
 */
export interface RequestPrivacyExecute {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
org_id: (string | null)
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_privacy_execute".
 */
export interface SuccessPrivacyExecute {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_subscription_boundary_apply".
 */
export interface RequestSubscriptionBoundaryApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
lease_token: Secret
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_subscription_boundary_apply".
 */
export interface SuccessSubscriptionBoundaryApply {
ok: true
data: WorkerResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_class_assignment_set".
 */
export interface RequestClassAssignmentSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
state?: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_class_assignment_set".
 */
export interface SuccessClassAssignmentSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_attendance_mark".
 */
export interface RequestEventAttendanceMark {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id: string
result: AttendanceResult
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_attendance_mark".
 */
export interface SuccessEventAttendanceMark {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_platform_owner_set".
 */
export interface RequestPlatformOwnerSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
verified_account_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_platform_owner_set".
 */
export interface SuccessPlatformOwnerSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_platform_owner_remove".
 */
export interface RequestPlatformOwnerRemove {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
replacement_verified_account_id?: (string | null)
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_platform_owner_remove".
 */
export interface SuccessPlatformOwnerRemove {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_center_manager_assign".
 */
export interface RequestCenterManagerAssign {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_center_manager_assign".
 */
export interface SuccessCenterManagerAssign {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_center_manager_revoke".
 */
export interface RequestCenterManagerRevoke {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_center_manager_revoke".
 */
export interface SuccessCenterManagerRevoke {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_block".
 */
export interface RequestAttendanceBlock {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
reason: BlockReason
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_block".
 */
export interface SuccessAttendanceBlock {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_attendance_close".
 */
export interface RequestEventAttendanceClose {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_attendance_close".
 */
export interface SuccessEventAttendanceClose {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_attendance_correct".
 */
export interface RequestEventAttendanceCorrect {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id: string
result: AttendanceResult
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_attendance_correct".
 */
export interface SuccessEventAttendanceCorrect {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_file_upload_complete".
 */
export interface RequestFileUploadComplete {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
checksum: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_file_upload_complete".
 */
export interface SuccessFileUploadComplete {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_negcredit_valuation_set".
 */
export interface RequestNegcreditValuationSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
format: SessionFormat
amount_minor: Money
currency: Currency
effective_at: Instant
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_negcredit_valuation_set".
 */
export interface SuccessNegcreditValuationSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_organizations".
 */
export interface TableOrganizations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
name: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
owner_person_id: string
state: OrganizationState
closed_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_centers".
 */
export interface TableCenters {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
name: Text
timezone: Text
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_rooms".
 */
export interface TableRooms {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
name: Text
state: RecordState
capacity?: (Count | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_room_capacities".
 */
export interface TableRoomCapacities {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
room_id: string
nominal: Int
maximum: Int
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_availability_rules".
 */
export interface TableAvailabilityRules {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
resource_kind: ResourceKind
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
resource_id: string
weekdays: Int[]
local_start: LocalTime
local_end: LocalTime
valid_from: Date
valid_until?: (Date | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_availability_exceptions".
 */
export interface TableAvailabilityExceptions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
resource_kind: ResourceKind
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
resource_id: string
starts_at: Instant
ends_at: Instant
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_policy_versions".
 */
export interface TablePolicyVersions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
scope_center_id?: (string | null)
key: Text
effective_at: Instant
mandatory: Bool
value: PolicyValue
previous_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_accounts".
 */
export interface TableAccounts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
auth_user_id?: (string | null)
state: AccountState
disabled_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_account_links".
 */
export interface TableAccountLinks {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
account_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
state: LinkState
verified_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_role_assignments".
 */
export interface TableRoleAssignments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
role: Role
scope_center_id?: (string | null)
state: RecordState
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
account_link_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_permission_overrides".
 */
export interface TablePermissionOverrides {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
permission: Permission
enabled: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_invitations".
 */
export interface TableInvitations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
email: Text
token_hash: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
inviter_account_id: string
expires_at: Instant
state: InviteState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_people".
 */
export interface TablePeople {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
display_name: Text
state: PersonState
merged_into_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_person_contacts".
 */
export interface TablePersonContacts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
kind: ContactKind
value: Text
verified_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_center_relationships".
 */
export interface TableCenterRelationships {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
kind: RelationshipKind
state: RelationshipState
started_at: Instant
ended_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_merge_requests".
 */
export interface TableMergeRequests {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
source_person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
state: ApprovalState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_merge_approvals".
 */
export interface TableMergeApprovals {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
merge_request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
approver_person_id: string
scope_hash: Text
approved_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_classes".
 */
export interface TableClasses {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
name: Text
external_open: Bool
state: RecordState
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_program_versions".
 */
export interface TableProgramVersions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id: string
weekdays: Int[]
local_start: LocalTime
duration_minutes: Int
starts_on: Date
ends_on: Date
state: RecordState
timezone?: (IanaZone | null)
spec_snapshot?: (ProgramSpec | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_sessions".
 */
export interface TableSessions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
class_id?: (string | null)
program_id?: (string | null)
format: SessionFormat
starts_at: Instant
ends_at: Instant
nominal: Int
maximum: Int
state: SessionState
attendance_state: AttendanceClosure
replaces_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
assignment_mode?: ("legacy" | "inherit" | "explicit")
actual_started_at?: (Instant | null)
started_agreements?: (LessonStartedAgreement[] | null)
category_capacities?: (CategoryCapacities | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonStartedAgreement".
 */
export interface LessonStartedAgreement {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
agreement_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_session_assignments".
 */
export interface TableSessionAssignments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
agreement_id?: (string | null)
state: RecordState
origin_class_assignment_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_resource_bookings".
 */
export interface TableResourceBookings {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
session_id?: (string | null)
event_id?: (string | null)
resource_kind: ResourceKind
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
resource_id: string
starts_at: Instant
ends_at: Instant
state: RecordState
duty_assignment?: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_lesson_requests".
 */
export interface TableLessonRequests {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
format: SessionFormat
requested_start: Instant
duration_minutes: Int
preferred_instructor_id?: (string | null)
state: RequestState
reservation_id?: (string | null)
expires_at?: (Instant | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_request_alternatives".
 */
export interface TableRequestAlternatives {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
starts_at: Instant
ends_at: Instant
instructor_id?: (string | null)
state: AlternativeState
selected_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_reservations".
 */
export interface TableReservations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
mode: BookingMode
state: ReservationState
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
policy_version_id: string
source_sale_id?: (string | null)
cancellation_reason?: (Text | null)
previous_id?: (string | null)
trial_offer_id?: (string | null)
negative_basis_minor?: (Money | null)
negative_basis_currency?: (Currency | null)
negative_basis_policy_id?: (string | null)
eligibility_snapshot?: (EligibilitySnapshot | null)
booking_obligation?: (LessonBookingObligation | null)
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonBookingObligation".
 */
export interface LessonBookingObligation {
captured_at: Instant
policies: LessonPolicyVersions
limits: LessonLimitSnapshot
debt_participation: boolean
obligation: ProtectedObligationView
blocked_policy: (BlockCreditPolicy | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonPolicyVersions".
 */
export interface LessonPolicyVersions {
negative_default: (string | null)
negative_upper: (string | null)
debt_participation: (string | null)
participation_block_credit: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonLimitSnapshot".
 */
export interface LessonLimitSnapshot {
override: (Count | null)
default_limit: (Count | null)
upper_limit: (Count | null)
effective_limit: (Count | null)
reserved_deficit: Count
consumed_deficit: Count
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
policy_version_ids: string[]
override_version: (PositiveInt | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ProtectedObligationView".
 */
export interface ProtectedObligationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * @minItems 0
 *
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
allocation_ids: string[]
/**
 * @minItems 0
 *
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
deficit_ids: string[]
quantity: Count
source_sale_id: (string | null)
existing_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_waitlist_entries".
 */
export interface TableWaitlistEntries {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
joined_at: Instant
state: WaitState
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_seat_offers".
 */
export interface TableSeatOffers {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
entry_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
expires_at: Instant
state: OfferState
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_attendance_entries".
 */
export interface TableAttendanceEntries {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
result: AttendanceResult
blocked_reason?: (Text | null)
consumes_on_close?: (Bool | null)
policy_snapshot?: (LessonAttendanceTerms | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonAttendanceTerms".
 */
export interface LessonAttendanceTerms {
cancellation: CancellationTerms
blocked: (BlockCreditPolicy | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_attendance_closures".
 */
export interface TableAttendanceClosures {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
revision: Int
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
closed_by: string
closed_at: Instant
corrects_id?: (string | null)
reason?: (Text | null)
plan_snapshot?: (LessonFinancialSnapshot | null)
rights_snapshot?: (LessonAttendanceEffect[] | null)
earnings_snapshot?: (LessonEarningSnapshot[] | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonAttendanceEffect".
 */
export interface LessonAttendanceEffect {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
before_result?: AttendanceResult
result: AttendanceResult
policy_snapshot: LessonAttendanceTerms
right: LessonRightTransition
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonRightTransition".
 */
export interface LessonRightTransition {
kind: ("allocation" | "deficit")
before: (TableEntitlementAllocations | TableCreditDeficits)
after: (TableEntitlementAllocations | TableCreditDeficits)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_entitlement_allocations".
 */
export interface TableEntitlementAllocations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
reservation_id?: (string | null)
event_registration_id?: (string | null)
quantity: Int
state: AllocationState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_credit_deficits".
 */
export interface TableCreditDeficits {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
quantity: Int
state: DeficitState
settled_sale_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonEarningSnapshot".
 */
export interface LessonEarningSnapshot {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
agreement_id: string
terms: PayTerms
participants: LessonEarningParticipant[]
format: SessionFormat
performed: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonEarningParticipant".
 */
export interface LessonEarningParticipant {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
sale_id: (string | null)
product_id: (string | null)
kind: EntitlementKind
trial: Bool
quantity: Count
unit_minor: (ExactMinorBasis | null)
currency: (Currency | null)
negative: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_products".
 */
export interface TableProducts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
name: Text
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_product_versions".
 */
export interface TableProductVersions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_id: string
kind: EntitlementKind
booking_mode: BookingMode
credits?: (Int | null)
price_minor: Money
currency: Currency
refund_method: RefundMethod
freeze_terms: FreezeTerms
quota?: (QuotaSpec | null)
effective_at: Instant
refund_terms?: RefundTerms
published_name: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_sales".
 */
export interface TableSales {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
net_minor: Money
currency: Currency
valid_from: Instant
valid_until?: (Instant | null)
state: SaleState
previous_sale_id?: (string | null)
terms_hash: Text
start_date: Date
end_date: Date
timezone: Text
paid_days: Int
participation_block_policy_snapshot?: (BlockCreditPolicy | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_entitlement_accounts".
 */
export interface TableEntitlementAccounts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
state: EntitlementState
balance_version: Int
}
/**
 *  Q-E02: center cancellation full linked settlement; existing occurrence/attendance evidence and append-only journals preserved.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_entitlement_movements".
 */
export interface TableEntitlementMovements {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
sale_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
reservation_id?: (string | null)
event_registration_id?: (string | null)
kind: CreditMove
quantity: Int
previous_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_quota_buckets".
 */
export interface TableQuotaBuckets {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
starts_at: Instant
ends_at: Instant
limit_count: Int
reserved_count: Int
consumed_count: Int
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_negative_limit_overrides".
 */
export interface TableNegativeLimitOverrides {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
limit_count: Int
reason: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 *  Q-E02: center cancellation full linked settlement; existing occurrence/attendance evidence and append-only journals preserved.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_debts".
 */
export interface TableDebts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
sale_id?: (string | null)
event_registration_id?: (string | null)
amount_minor: Money
currency: Currency
due_at: Instant
state: DebtState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_cash_movements".
 */
export interface TableCashMovements {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
kind: CashMove
amount_minor: Money
currency: Currency
occurred_at: Instant
previous_id?: (string | null)
reason?: (Text | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_debt_allocations".
 */
export interface TableDebtAllocations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
cash_movement_id?: (string | null)
credit_movement_id?: (string | null)
amount_minor: SignedMoney
previous_id?: (string | null)
}
/**
 *  Q-E02: center cancellation full linked settlement; existing occurrence/attendance evidence and append-only journals preserved.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_student_credit_movements".
 */
export interface TableStudentCreditMovements {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
kind: StudentCreditMove
amount_minor: Money
currency: Currency
source_cash_id?: (string | null)
source_sale_id?: (string | null)
previous_id?: (string | null)
source_debt_id?: (string | null)
operation_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_debt_adjustments".
 */
export interface TableDebtAdjustments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
amount_minor: Money
direction: Direction
previous_id?: (string | null)
reason: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_instructor_agreements".
 */
export interface TableInstructorAgreements {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
format: SessionFormat
valid_from: Instant
valid_until?: (Instant | null)
model: PayModel
terms: PayTerms
state: RecordState
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
supersedes_id?: (string | null)
published_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_earnings".
 */
export interface TableEarnings {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
session_id?: (string | null)
event_assignment_id?: (string | null)
agreement_id?: (string | null)
amount_minor: Money
currency: Currency
basis: EarningBasis
previous_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
direction: EarningDirection
closure_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_instructor_payments".
 */
export interface TableInstructorPayments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
amount_minor: Money
currency: Currency
occurred_at: Instant
reason?: (Text | null)
previous_id?: (string | null)
operation_id?: (string | null)
direction: Direction
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_earning_allocations".
 */
export interface TableEarningAllocations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
earning_id: string
amount_minor: SignedMoney
previous_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_leads".
 */
export interface TableLeads {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
source: Text
interest: Text
assigned_person_id?: (string | null)
state: LeadState
last_meaningful_contact_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_crm_activities".
 */
export interface TableCrmActivities {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
lead_id: (string | null)
kind: CrmActivityKind
due_at?: (Instant | null)
completed_at?: (Instant | null)
outcome?: (Text | null)
note?: (Text | null)
person_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_trial_offers".
 */
export interface TableTrialOffers {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
session_id?: (string | null)
state: OfferState
expires_at: Instant
terms_snapshot?: (TrialOfferTerms | null)
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "TrialOfferTerms".
 */
export interface TrialOfferTerms {
price_minor: Money
currency: Currency
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_trial_usages".
 */
export interface TableTrialUsages {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
used_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_segments".
 */
export interface TableSegments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
name: Text
definition: SegmentDefinition
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_automations".
 */
export interface TableAutomations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
name: Text
trigger: AutomationTrigger
segment_id?: (string | null)
action: AutomationAction
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_automation_runs".
 */
export interface TableAutomationRuns {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
automation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
event_key: Text
state: JobState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_notification_preferences".
 */
export interface TableNotificationPreferences {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
channel: NotificationChannel
purpose: NotificationPurpose
enabled: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_notifications".
 */
export interface TableNotifications {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
recipient_person_id: string
kind: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
subject_id: string
payload: NotificationPayload
read_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_outbox_jobs".
 */
export interface TableOutboxJobs {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
notification_id?: (string | null)
kind: Text
dedupe_key: Text
state: JobState
attempts: Int
next_attempt_at?: (Instant | null)
lease_until?: (Instant | null)
provider_reference?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_report_jobs".
 */
export interface TableReportJobs {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
requester_account_id: string
report_kind: ReportKind
filters: ReportFilters
state: JobState
file_id?: (string | null)
expires_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_saas_plan_versions".
 */
export interface TableSaasPlanVersions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
name: Plan
effective_at: Instant
price_minor: Money
currency: Currency
period: SaasPeriod
limits: PlanLimits
features: Text[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_saas_subscriptions".
 */
export interface TableSaasSubscriptions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
plan_version_id: string
starts_at: (Instant | null)
period_end: (Instant | null)
grace_until?: (Instant | null)
state: SubscriptionState
cancel_at_period_end: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_saas_change_requests".
 */
export interface TableSaasChangeRequests {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id: string
kept_center_id?: (string | null)
effective_at: Instant
quote_id?: (string | null)
state: ChangeState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_saas_quotes".
 */
export interface TableSaasQuotes {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
from_plan_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
to_plan_id: string
amount_minor: Money
currency: Currency
expires_at: Instant
state: OfferState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_saas_payment_verifications".
 */
export interface TableSaasPaymentVerifications {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
amount_minor: Money
currency: Currency
occurred_at: Instant
verified_at?: (Instant | null)
verified_by?: (string | null)
state: ApprovalState
reference: Text
period_key?: (Instant | null)
}
/**
 *  Q-E02: center cancellation full linked settlement; existing occurrence/attendance evidence and append-only journals preserved.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_events".
 */
export interface TableEvents {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
name: Text
starts_at: Instant
ends_at: Instant
timezone: Text
venue: VenueSpec
nominal: Int
maximum: Int
state: EventState
terms: EventTerms
published: Bool
attendance_state: AttendanceClosure
attendance_revision: Int
actual_started_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_event_assignments".
 */
export interface TableEventAssignments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
fee_minor: Money
currency: Currency
verified_at?: (Instant | null)
verified_by?: (string | null)
performed?: (Bool | null)
}
/**
 *  Q-E02: center cancellation full linked settlement; existing occurrence/attendance evidence and append-only journals preserved.
 *
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_event_registrations".
 */
export interface TableEventRegistrations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
amount_minor: Money
currency: Currency
terms_hash: Text
state: EventRegistrationState
attendance_result: AttendanceResult
terms_snapshot: EventTerms
participant_cancellation?: (ParticipantCancellationBasis | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_documents".
 */
export interface TableDocuments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
name: Text
scope_center_id?: (string | null)
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_document_versions".
 */
export interface TableDocumentVersions {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
document_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
version_label: Text
content_hash: Text
effective_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_document_requirements".
 */
export interface TableDocumentRequirements {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
document_version_id: string
scope: DocumentScope
operation: DocumentGate
renewed_acceptance: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_document_acceptances".
 */
export interface TableDocumentAcceptances {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
account_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
document_version_id: string
accepted_at: Instant
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
context: AcceptanceContext
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_files".
 */
export interface TableFiles {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
owner_person_id?: (string | null)
object_key: Text
mime: Text
size_bytes: Int
checksum?: (Text | null)
purpose: FilePurpose
state: FileState
expires_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_previews".
 */
export interface TablePreviews {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
actor_account_id: string
operation: Text
scope_hash: Text
dependencies: PreviewDependencies
result: PreviewResult
state: PreviewState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_operation_receipts".
 */
export interface TableOperationReceipts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
org_id?: (string | null)
actor_account_id?: (string | null)
actor_fingerprint: Text
operation: OperationName
key_hash: Text
payload_hash: Text
state: OperationState
result?: (OperationResult | null)
result_expires_at: Instant
business_reference?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_audit_events".
 */
export interface TableAuditEvents {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
actor_account_id?: (string | null)
actor_person_id?: (string | null)
action: OperationName
subject_table: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
subject_id: string
reason?: (Text | null)
diff?: (AuditDiff | null)
operation_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_import_jobs".
 */
export interface TableImportJobs {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
requester_account_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
mapping: ImportMapping
state: JobState
file_checksum: Text
preview_id?: (string | null)
source_namespace: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_import_rows".
 */
export interface TableImportRows {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
job_id: string
row_number: Int
source_key: Text
payload: ImportRow
state: ImportRowState
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
created_references: string[]
error_code?: (Text | null)
source_namespace: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_publications".
 */
export interface TablePublications {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
slug: Text
session_id?: (string | null)
event_id?: (string | null)
published: Bool
public_details?: (PublicPublicationDetails | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_public_applications".
 */
export interface TablePublicApplications {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
publication_id: string
target_contact: Text
target_hash: Text
state: ApplicationState
bot_verified_at: Instant
request_reference?: (string | null)
person_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_privacy_requests".
 */
export interface TablePrivacyRequests {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
org_id?: (string | null)
kind: PrivacyKind
requester_account_id?: (string | null)
scope: PrivacyScope
state: PrivacyState
requested_at: Instant
completed_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_retention_holds".
 */
export interface TableRetentionHolds {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
subject_table: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
subject_id: string
reason: Text
authority_reference: Text
review_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_deletion_receipts".
 */
export interface TableDeletionReceipts {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
org_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
system: Text
scope_hash: Text
completed_at?: (Instant | null)
state: JobState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_class_assignments".
 */
export interface TableClassAssignments {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_rate_limit_windows".
 */
export interface TableRateLimitWindows {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version?: PositiveInt
key_hash: Text
dimension: RateDimension
starts_at: Instant
ends_at: Instant
attempt_count: Int
accepted_count: Int
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_disciplines".
 */
export interface TableDisciplines {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
name: Text
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_center_disciplines".
 */
export interface TableCenterDisciplines {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
state: RecordState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_person_disciplines".
 */
export interface TablePersonDisciplines {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
kind: DisciplineRelationshipKind
state: RelationshipState
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DisciplineView".
 */
export interface DisciplineView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
name: Text
state: RecordState
version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DisciplinePage".
 */
export interface DisciplinePage {
items: DisciplineView[]
next_cursor: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_disciplines_list".
 */
export interface RequestDisciplinesList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_disciplines_list".
 */
export interface SuccessDisciplinesList {
ok: true
data: DisciplinePage
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_discipline_save".
 */
export interface RequestDisciplineSave {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
discipline_id?: (string | null)
name: Text
state: RecordState
expected_version?: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_discipline_save".
 */
export interface SuccessDisciplineSave {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_center_discipline_set".
 */
export interface RequestCenterDisciplineSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
state: RecordState
expected_version?: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_center_discipline_set".
 */
export interface SuccessCenterDisciplineSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_person_discipline_set".
 */
export interface RequestPersonDisciplineSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
kind: DisciplineRelationshipKind
state: RelationshipState
expected_version?: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_person_discipline_set".
 */
export interface SuccessPersonDisciplineSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_event_disciplines".
 */
export interface TableEventDisciplines {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_get".
 */
export interface RequestEventGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_get".
 */
export interface SuccessEventGet {
ok: true
data: EventView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_registration_preview".
 */
export interface SuccessEventRegistrationPreview {
ok: true
data: Preview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "FailureEnvelope".
 */
export interface FailureEnvelope {
ok: false
error: SafeError
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Table_event_payment_preparations".
 */
export interface TableEventPaymentPreparations {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
registration_id: (string | null)
state: EventPaymentPreparationState
terms_snapshot: EventTerms
terms_hash: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "EventPaymentPreparationView".
 */
export interface EventPaymentPreparationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
registration_id: (string | null)
state: EventPaymentPreparationState
version: PositiveInt
amount_minor: Money
currency: Currency
paid_minor: Money
remaining_minor: Money
credited_minor: Money
student_credit_available_minor: Money
terms: EventTerms
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_payment_prepare".
 */
export interface RequestEventPaymentPrepare {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_payment_get".
 */
export interface RequestEventPaymentGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preparation_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_payment_prepare".
 */
export interface SuccessEventPaymentPrepare {
ok: true
data: EventPaymentPreparationView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_payment_get".
 */
export interface SuccessEventPaymentGet {
ok: true
data: EventPaymentPreparationView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_actual_start_record".
 */
export interface RequestEventActualStartRecord {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
expected_version: PositiveInt
actual_started_at: Instant
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_actual_start_record".
 */
export interface SuccessEventActualStartRecord {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_event_actual_start_correct".
 */
export interface RequestEventActualStartCorrect {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
expected_version: PositiveInt
actual_started_at: (Instant | null)
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_event_actual_start_correct".
 */
export interface SuccessEventActualStartCorrect {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AgreementVersionView".
 */
export interface AgreementVersionView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
format: SessionFormat
valid: AgreementValidity
supersedes_id: (string | null)
terms: PayTerms
published_at: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AgreementValidity".
 */
export interface AgreementValidity {
starts_at: Instant
ends_at: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AgreementVersionPage".
 */
export interface AgreementVersionPage {
/**
 * @minItems 0
 */
items: AgreementVersionView[]
next_cursor: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementStateView".
 */
export interface ManagementStateView {
operation: OperationName
entity: (EntityRef | null)
exists: Bool
state: (("accepted" | "active" | "alternative_offered" | "applied" | "approved" | "cancelled" | "capacity_closed" | "closed" | "completed" | "consumed" | "converted" | "current" | "deleted" | "deletion_pending" | "draft" | "ended" | "event_cancelled" | "expired" | "failed" | "failed_final" | "grace" | "in_progress" | "inactive" | "invalid" | "invalidated" | "left" | "merged" | "occurred" | "offered" | "open" | "partial" | "pending" | "pending_payment" | "pending_upload" | "planned" | "prepared" | "published" | "read" | "ready" | "registered" | "rejected" | "released" | "requested" | "reserved" | "result_expired" | "retry_wait" | "reviewed" | "revoked" | "running" | "scheduled" | "settled" | "succeeded" | "superseded" | "suspended" | "terminated" | "unread" | "valid" | "waiting" | "withdrawn") | null)
/**
 * @minItems 0
 */
versions: EntityVersion[]
as_of: Instant
current: (ManagementProjection | null)
request_detail?: LessonRequestView
waitlist_detail?: WaitlistEntryView
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_profile_update_v1".
 */
export interface ManagementProjectionAccountProfileUpdateV1 {
operation: "account_profile_update_v1"
values: {
display_name?: Text
given_name?: (string | null)
family_name?: (string | null)
unverified_phone?: (string | null)
photo?: (SettingsMediaAsset | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_delete_preview_v1".
 */
export interface ManagementProjectionAccountDeletePreviewV1 {
operation: "account_delete_preview_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_delete_apply_v1".
 */
export interface ManagementProjectionAccountDeleteApplyV1 {
operation: "account_delete_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_create_v1".
 */
export interface ManagementProjectionOrganizationCreateV1 {
operation: "organization_create_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
verified_account_id?: string
name?: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
initial_plan_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_update_v1".
 */
export interface ManagementProjectionOrganizationUpdateV1 {
operation: "organization_update_v1"
values: {
name?: Text
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_close_preview_v1".
 */
export interface ManagementProjectionOrganizationClosePreviewV1 {
operation: "organization_close_preview_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_close_apply_v1".
 */
export interface ManagementProjectionOrganizationCloseApplyV1 {
operation: "organization_close_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_reopen_v1".
 */
export interface ManagementProjectionOrganizationReopenV1 {
operation: "organization_reopen_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_delete_preview_v1".
 */
export interface ManagementProjectionOrganizationDeletePreviewV1 {
operation: "organization_delete_preview_v1"
values: {
all_data?: true
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_organization_delete_apply_v1".
 */
export interface ManagementProjectionOrganizationDeleteApplyV1 {
operation: "organization_delete_apply_v1"
values: {
all_data?: true
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_center_create_v1".
 */
export interface ManagementProjectionCenterCreateV1 {
operation: "center_create_v1"
values: {
name?: Text
timezone?: IanaZone
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_center_update_v1".
 */
export interface ManagementProjectionCenterUpdateV1 {
operation: "center_update_v1"
values: {
name?: Text
timezone?: IanaZone
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_room_save_v1".
 */
export interface ManagementProjectionRoomSaveV1 {
operation: "room_save_v1"
values: {
room_id?: (string | null)
name?: Text
capacity?: (Count | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_availability_save_v1".
 */
export interface ManagementProjectionAvailabilitySaveV1 {
operation: "availability_save_v1"
values: {
rule_id?: (string | null)
resource?: ResourceRef
rule?: AvailabilityRule
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_availability_exception_save_v1".
 */
export interface ManagementProjectionAvailabilityExceptionSaveV1 {
operation: "availability_exception_save_v1"
values: {
resource?: ResourceRef
interval?: Interval
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_policy_publish_v1".
 */
export interface ManagementProjectionPolicyPublishV1 {
operation: "policy_publish_v1"
values: {
key?: PolicyKey
value?: PolicyValue
effective_at?: Instant
mandatory?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_role_assign_v1".
 */
export interface ManagementProjectionRoleAssignV1 {
operation: "role_assign_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
role?: OperationalRole
scope?: RoleScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_role_revoke_v1".
 */
export interface ManagementProjectionRoleRevokeV1 {
operation: "role_revoke_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
assignment_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_permission_set_v1".
 */
export interface ManagementProjectionPermissionSetV1 {
operation: "permission_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
permission?: Permission
enabled?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_org_manager_assign_v1".
 */
export interface ManagementProjectionOrgManagerAssignV1 {
operation: "org_manager_assign_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_org_manager_revoke_v1".
 */
export interface ManagementProjectionOrgManagerRevokeV1 {
operation: "org_manager_revoke_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_manager_self_assign_center_v1".
 */
export interface ManagementProjectionManagerSelfAssignCenterV1 {
operation: "manager_self_assign_center_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_center_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_access_send_v1".
 */
export interface ManagementProjectionAccountAccessSendV1 {
operation: "account_access_send_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_access_revoke_v1".
 */
export interface ManagementProjectionAccountAccessRevokeV1 {
operation: "account_access_revoke_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
invitation_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_access_accept_v1".
 */
export interface ManagementProjectionAccountAccessAcceptV1 {
operation: "account_access_accept_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_account_link_remove_v1".
 */
export interface ManagementProjectionAccountLinkRemoveV1 {
operation: "account_link_remove_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
link_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_person_create_v1".
 */
export interface ManagementProjectionPersonCreateV1 {
operation: "person_create_v1"
values: {
display_name?: Text
contacts?: ContactInput[]
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_person_update_v1".
 */
export interface ManagementProjectionPersonUpdateV1 {
operation: "person_update_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
patch?: PersonPatch
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_student_activate_v1".
 */
export interface ManagementProjectionStudentActivateV1 {
operation: "student_activate_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_student_deactivate_v1".
 */
export interface ManagementProjectionStudentDeactivateV1 {
operation: "student_deactivate_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_person_merge_preview_v1".
 */
export interface ManagementProjectionPersonMergePreviewV1 {
operation: "person_merge_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
source_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_person_merge_approve_v1".
 */
export interface ManagementProjectionPersonMergeApproveV1 {
operation: "person_merge_approve_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
approval_center_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_person_merge_apply_v1".
 */
export interface ManagementProjectionPersonMergeApplyV1 {
operation: "person_merge_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_class_save_v1".
 */
export interface ManagementProjectionClassSaveV1 {
operation: "class_save_v1"
values: {
class_id?: (string | null)
name?: Text
external_open?: Bool
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_program_preview_v1".
 */
export interface ManagementProjectionProgramPreviewV1 {
operation: "program_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id?: string
schedule?: ProgramSpec
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_program_apply_v1".
 */
export interface ManagementProjectionProgramApplyV1 {
operation: "program_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_create_v1".
 */
export interface ManagementProjectionSessionCreateV1 {
operation: "session_create_v1"
values: {
class_id?: (string | null)
interval?: Interval
resources?: ResourceRef[]
assignments?: DutyInput[]
capacity?: Capacity
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
format?: SessionFormat
inherit_class_assignments?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_change_preview_v1".
 */
export interface ManagementProjectionSessionChangePreviewV1 {
operation: "session_change_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
patch?: SessionPatch
scope?: ChangeScope
offset_choices?: LocalOffsetChoice[]
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_change_apply_v1".
 */
export interface ManagementProjectionSessionChangeApplyV1 {
operation: "session_change_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_capacity_set_v1".
 */
export interface ManagementProjectionSessionCapacitySetV1 {
operation: "session_capacity_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
capacity?: SessionCapacity
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_cancel_preview_v1".
 */
export interface ManagementProjectionSessionCancelPreviewV1 {
operation: "session_cancel_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_cancel_apply_v1".
 */
export interface ManagementProjectionSessionCancelApplyV1 {
operation: "session_cancel_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_replacement_session_create_v1".
 */
export interface ManagementProjectionReplacementSessionCreateV1 {
operation: "replacement_session_create_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
replaces_id?: string
interval?: Interval
resources?: ResourceRef[]
capacity?: Capacity
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_session_assignment_set_v1".
 */
export interface ManagementProjectionSessionAssignmentSetV1 {
operation: "session_assignment_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
duty?: Duty
agreement_id?: (string | null)
state?: RecordState
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lesson_request_create_v1".
 */
export interface ManagementProjectionLessonRequestCreateV1 {
operation: "lesson_request_create_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
requested_start?: Instant
duration_minutes?: Int
preferred_instructor_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lesson_request_withdraw_v1".
 */
export interface ManagementProjectionLessonRequestWithdrawV1 {
operation: "lesson_request_withdraw_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lesson_request_reject_v1".
 */
export interface ManagementProjectionLessonRequestRejectV1 {
operation: "lesson_request_reject_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lesson_request_offer_alternative_v1".
 */
export interface ManagementProjectionLessonRequestOfferAlternativeV1 {
operation: "lesson_request_offer_alternative_v1"
values: {
alternatives?: RequestAlternative[]
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lesson_request_accept_alternative_v1".
 */
export interface ManagementProjectionLessonRequestAcceptAlternativeV1 {
operation: "lesson_request_accept_alternative_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
alternative_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lesson_request_approve_v1".
 */
export interface ManagementProjectionLessonRequestApproveV1 {
operation: "lesson_request_approve_v1"
values: {
session_id?: (string | null)
session?: (SessionCreate | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_reservation_create_v1".
 */
export interface ManagementProjectionReservationCreateV1 {
operation: "reservation_create_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
source_sale_id?: (string | null)
mode?: BookingMode
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_reservation_cancel_v1".
 */
export interface ManagementProjectionReservationCancelV1 {
operation: "reservation_cancel_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_waitlist_join_v1".
 */
export interface ManagementProjectionWaitlistJoinV1 {
operation: "waitlist_join_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_waitlist_leave_v1".
 */
export interface ManagementProjectionWaitlistLeaveV1 {
operation: "waitlist_leave_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
entry_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_seat_offer_accept_v1".
 */
export interface ManagementProjectionSeatOfferAcceptV1 {
operation: "seat_offer_accept_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_seat_offer_reject_v1".
 */
export interface ManagementProjectionSeatOfferRejectV1 {
operation: "seat_offer_reject_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_attendance_mark_v1".
 */
export interface ManagementProjectionAttendanceMarkV1 {
operation: "attendance_mark_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id?: string
result?: OrdinaryAttendanceResult
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_attendance_close_v1".
 */
export interface ManagementProjectionAttendanceCloseV1 {
operation: "attendance_close_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_attendance_correct_preview_v1".
 */
export interface ManagementProjectionAttendanceCorrectPreviewV1 {
operation: "attendance_correct_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
corrections?: AttendanceCorrection[]
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_attendance_correct_apply_v1".
 */
export interface ManagementProjectionAttendanceCorrectApplyV1 {
operation: "attendance_correct_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_product_publish_v1".
 */
export interface ManagementProjectionProductPublishV1 {
operation: "product_publish_v1"
values: {
product_id?: (string | null)
terms?: ProductTerms
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_preview_v1".
 */
export interface ManagementProjectionSalePreviewV1 {
operation: "sale_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id?: string
start_date?: Date
net_minor?: (Money | null)
end_date?: Date
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_apply_v1".
 */
export interface ManagementProjectionSaleApplyV1 {
operation: "sale_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_entitlement_extend_v1".
 */
export interface ManagementProjectionEntitlementExtendV1 {
operation: "entitlement_extend_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id?: string
end_date?: Date
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_credit_adjust_v1".
 */
export interface ManagementProjectionCreditAdjustV1 {
operation: "credit_adjust_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id?: string
quantity?: Int
direction?: Direction
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_negative_limit_set_v1".
 */
export interface ManagementProjectionNegativeLimitSetV1 {
operation: "negative_limit_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
allowed_negative_credits?: Count
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_freeze_preview_v1".
 */
export interface ManagementProjectionFreezePreviewV1 {
operation: "freeze_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id?: string
dates?: DateInterval
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_freeze_apply_v1".
 */
export interface ManagementProjectionFreezeApplyV1 {
operation: "freeze_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_freeze_end_preview_v1".
 */
export interface ManagementProjectionFreezeEndPreviewV1 {
operation: "freeze_end_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
freeze_id?: string
end_date?: Date
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_freeze_end_apply_v1".
 */
export interface ManagementProjectionFreezeEndApplyV1 {
operation: "freeze_end_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_terminate_preview_v1".
 */
export interface ManagementProjectionSaleTerminatePreviewV1 {
operation: "sale_terminate_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_terminate_apply_v1".
 */
export interface ManagementProjectionSaleTerminateApplyV1 {
operation: "sale_terminate_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_refund_preview_v1".
 */
export interface ManagementProjectionSaleRefundPreviewV1 {
operation: "sale_refund_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_refund_apply_v1".
 */
export interface ManagementProjectionSaleRefundApplyV1 {
operation: "sale_refund_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_change_preview_v1".
 */
export interface ManagementProjectionSaleChangePreviewV1 {
operation: "sale_change_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
new_product_version_id?: string
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
keep_reservation_ids?: string[]
start_date?: Date
end_date?: Date
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_change_apply_v1".
 */
export interface ManagementProjectionSaleChangeApplyV1 {
operation: "sale_change_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_renew_preview_v1".
 */
export interface ManagementProjectionSaleRenewPreviewV1 {
operation: "sale_renew_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
previous_sale_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id?: string
start_date?: Date
end_date?: Date
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_sale_renew_apply_v1".
 */
export interface ManagementProjectionSaleRenewApplyV1 {
operation: "sale_renew_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_collection_record_v1".
 */
export interface ManagementProjectionCollectionRecordV1 {
operation: "collection_record_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
amount_minor?: PositiveMoney
currency?: Currency
occurred_at?: Instant
debt_ids?: (string[] | null)
note?: (Text | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_collection_correct_preview_v1".
 */
export interface ManagementProjectionCollectionCorrectPreviewV1 {
operation: "collection_correct_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
cash_movement_id?: string
correction?: CashCorrection
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_collection_correct_apply_v1".
 */
export interface ManagementProjectionCollectionCorrectApplyV1 {
operation: "collection_correct_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_student_credit_refund_v1".
 */
export interface ManagementProjectionStudentCreditRefundV1 {
operation: "student_credit_refund_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
amount_minor?: PositiveMoney
currency?: Currency
occurred_at?: Instant
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_student_credit_offset_v1".
 */
export interface ManagementProjectionStudentCreditOffsetV1 {
operation: "student_credit_offset_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id?: string
amount_minor?: PositiveMoney
currency?: Currency
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_debt_adjust_v1".
 */
export interface ManagementProjectionDebtAdjustV1 {
operation: "debt_adjust_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id?: string
amount_minor?: PositiveMoney
direction?: Direction
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_instructor_agreement_publish_v1".
 */
export interface ManagementProjectionInstructorAgreementPublishV1 {
operation: "instructor_agreement_publish_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
format?: SessionFormat
valid?: Interval
terms?: PayTerms
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
supersedes_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_instructor_payment_record_v1".
 */
export interface ManagementProjectionInstructorPaymentRecordV1 {
operation: "instructor_payment_record_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
earning_ids?: string[]
amount_minor?: PositiveMoney
currency?: Currency
occurred_at?: Instant
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_instructor_payment_correct_v1".
 */
export interface ManagementProjectionInstructorPaymentCorrectV1 {
operation: "instructor_payment_correct_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id?: string
correction?: CashCorrection
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lead_save_v1".
 */
export interface ManagementProjectionLeadSaveV1 {
operation: "lead_save_v1"
values: {
lead_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
source?: Text
interest?: Text
assigned_to?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_crm_activity_save_v1".
 */
export interface ManagementProjectionCrmActivitySaveV1 {
operation: "crm_activity_save_v1"
values: {
lead_id?: (string | null)
kind?: CrmActivityKind
due_at?: (Instant | null)
outcome?: (Text | null)
note?: (Text | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
activity_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_trial_offer_create_v1".
 */
export interface ManagementProjectionTrialOfferCreateV1 {
operation: "trial_offer_create_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id?: string
session_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id?: string
expires_at?: Instant
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_trial_registration_confirm_v1".
 */
export interface ManagementProjectionTrialRegistrationConfirmV1 {
operation: "trial_registration_confirm_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_lead_convert_v1".
 */
export interface ManagementProjectionLeadConvertV1 {
operation: "lead_convert_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_segment_save_v1".
 */
export interface ManagementProjectionSegmentSaveV1 {
operation: "segment_save_v1"
values: {
segment_id?: (string | null)
name?: Text
definition?: SegmentDefinition
scope?: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_automation_save_v1".
 */
export interface ManagementProjectionAutomationSaveV1 {
operation: "automation_save_v1"
values: {
automation_id?: (string | null)
definition?: AutomationDefinition
scope?: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_notification_mark_read_v1".
 */
export interface ManagementProjectionNotificationMarkReadV1 {
operation: "notification_mark_read_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
notification_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_notification_preferences_set_v1".
 */
export interface ManagementProjectionNotificationPreferencesSetV1 {
operation: "notification_preferences_set_v1"
values: {
channel?: NotificationChannel
purpose?: NotificationPurpose
enabled?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_report_export_start_v1".
 */
export interface ManagementProjectionReportExportStartV1 {
operation: "report_export_start_v1"
values: {
report?: ReportKind
filters?: ReportFilters
format?: ExportFormat
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_import_upload_prepare_v1".
 */
export interface ManagementProjectionImportUploadPrepareV1 {
operation: "import_upload_prepare_v1"
values: {
filename?: Text
mime?: Text
bytes?: Count
checksum?: Text
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_import_preview_v1".
 */
export interface ManagementProjectionImportPreviewV1 {
operation: "import_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id?: string
mapping?: ImportMapping
source_namespace?: Text
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_import_apply_v1".
 */
export interface ManagementProjectionImportApplyV1 {
operation: "import_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_subscription_upgrade_quote_v1".
 */
export interface ManagementProjectionSubscriptionUpgradeQuoteV1 {
operation: "subscription_upgrade_quote_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_subscription_downgrade_request_v1".
 */
export interface ManagementProjectionSubscriptionDowngradeRequestV1 {
operation: "subscription_downgrade_request_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id?: string
kept_center_id?: (string | null)
kept_scope?: StarterRetainedScope
expected_version?: PositiveInt
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_subscription_change_cancel_v1".
 */
export interface ManagementProjectionSubscriptionChangeCancelV1 {
operation: "subscription_change_cancel_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
change_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_subscription_renewal_set_v1".
 */
export interface ManagementProjectionSubscriptionRenewalSetV1 {
operation: "subscription_renewal_set_v1"
values: {
renew?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_saas_payment_submit_v1".
 */
export interface ManagementProjectionSaasPaymentSubmitV1 {
operation: "saas_payment_submit_v1"
values: {
amount_minor?: Money
currency?: Currency
reference?: Text
occurred_at?: Instant
quote_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_saas_payment_verify_v1".
 */
export interface ManagementProjectionSaasPaymentVerifyV1 {
operation: "saas_payment_verify_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id?: string
accepted?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_saas_grace_extend_v1".
 */
export interface ManagementProjectionSaasGraceExtendV1 {
operation: "saas_grace_extend_v1"
values: {
until?: Instant
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_save_v1".
 */
export interface ManagementProjectionEventSaveV1 {
operation: "event_save_v1"
values: {
event_id?: (string | null)
name?: Text
interval?: Interval
timezone?: IanaZone
venue?: VenueSpec
capacity?: Capacity
terms?: EventTerms
assignments?: EventDutyInput[]
discipline_ids?: EventDisciplineIds
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_publish_v1".
 */
export interface ManagementProjectionEventPublishV1 {
operation: "event_publish_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
published?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_register_v1".
 */
export interface ManagementProjectionEventRegisterV1 {
operation: "event_register_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
sale_id?: (string | null)
preparation_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_registration_cancel_v1".
 */
export interface ManagementProjectionEventRegistrationCancelV1 {
operation: "event_registration_cancel_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_complete_v1".
 */
export interface ManagementProjectionEventCompleteV1 {
operation: "event_complete_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_duty_verify_v1".
 */
export interface ManagementProjectionEventDutyVerifyV1 {
operation: "event_duty_verify_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
assignment_id?: string
performed?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_cancel_preview_v1".
 */
export interface ManagementProjectionEventCancelPreviewV1 {
operation: "event_cancel_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_cancel_apply_v1".
 */
export interface ManagementProjectionEventCancelApplyV1 {
operation: "event_cancel_apply_v1"
values: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_document_upload_prepare_v1".
 */
export interface ManagementProjectionDocumentUploadPrepareV1 {
operation: "document_upload_prepare_v1"
values: {
name?: Text
mime?: Text
bytes?: Count
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_document_version_publish_v1".
 */
export interface ManagementProjectionDocumentVersionPublishV1 {
operation: "document_version_publish_v1"
values: {
document_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id?: string
version_label?: Text
requirements?: DocumentRequirement[]
scope?: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_document_accept_v1".
 */
export interface ManagementProjectionDocumentAcceptV1 {
operation: "document_accept_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
document_version_id?: string
context?: AcceptanceContext
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_publication_set_v1".
 */
export interface ManagementProjectionPublicationSetV1 {
operation: "publication_set_v1"
values: {
session_id?: (string | null)
event_id?: (string | null)
published?: Bool
public_details?: (PublicPublicationDetails | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_public_application_submit_v1".
 */
export interface ManagementProjectionPublicApplicationSubmitV1 {
operation: "public_application_submit_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
publication_id?: string
contact?: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
client_request_key?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_public_application_review_v1".
 */
export interface ManagementProjectionPublicApplicationReviewV1 {
operation: "public_application_review_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
application_id?: string
action?: ApplicationAction
person_id?: (string | null)
contact?: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
publication_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_class_assignment_set_v1".
 */
export interface ManagementProjectionClassAssignmentSetV1 {
operation: "class_assignment_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
duty?: Duty
state?: RecordState
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_attendance_mark_v1".
 */
export interface ManagementProjectionEventAttendanceMarkV1 {
operation: "event_attendance_mark_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id?: string
result?: AttendanceResult
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_platform_owner_set_v1".
 */
export interface ManagementProjectionPlatformOwnerSetV1 {
operation: "platform_owner_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
verified_account_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_platform_owner_remove_v1".
 */
export interface ManagementProjectionPlatformOwnerRemoveV1 {
operation: "platform_owner_remove_v1"
values: {
replacement_verified_account_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_center_manager_assign_v1".
 */
export interface ManagementProjectionCenterManagerAssignV1 {
operation: "center_manager_assign_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_center_manager_revoke_v1".
 */
export interface ManagementProjectionCenterManagerRevokeV1 {
operation: "center_manager_revoke_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_attendance_block_v1".
 */
export interface ManagementProjectionAttendanceBlockV1 {
operation: "attendance_block_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_attendance_close_v1".
 */
export interface ManagementProjectionEventAttendanceCloseV1 {
operation: "event_attendance_close_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_attendance_correct_v1".
 */
export interface ManagementProjectionEventAttendanceCorrectV1 {
operation: "event_attendance_correct_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id?: string
result?: AttendanceResult
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_file_upload_complete_v1".
 */
export interface ManagementProjectionFileUploadCompleteV1 {
operation: "file_upload_complete_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id?: string
checksum?: Text
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_negcredit_valuation_set_v1".
 */
export interface ManagementProjectionNegcreditValuationSetV1 {
operation: "negcredit_valuation_set_v1"
values: {
format?: SessionFormat
amount_minor?: Money
currency?: Currency
effective_at?: Instant
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_discipline_save_v1".
 */
export interface ManagementProjectionDisciplineSaveV1 {
operation: "discipline_save_v1"
values: {
discipline_id?: (string | null)
name?: Text
state?: RecordState
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_center_discipline_set_v1".
 */
export interface ManagementProjectionCenterDisciplineSetV1 {
operation: "center_discipline_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
state?: RecordState
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_person_discipline_set_v1".
 */
export interface ManagementProjectionPersonDisciplineSetV1 {
operation: "person_discipline_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
kind?: DisciplineRelationshipKind
state?: RelationshipState
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_registration_preview_v1".
 */
export interface ManagementProjectionEventRegistrationPreviewV1 {
operation: "event_registration_preview_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
sale_id?: (string | null)
preparation_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_payment_prepare_v1".
 */
export interface ManagementProjectionEventPaymentPrepareV1 {
operation: "event_payment_prepare_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_actual_start_record_v1".
 */
export interface ManagementProjectionEventActualStartRecordV1 {
operation: "event_actual_start_record_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
actual_started_at?: Instant
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_event_actual_start_correct_v1".
 */
export interface ManagementProjectionEventActualStartCorrectV1 {
operation: "event_actual_start_correct_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id?: string
actual_started_at?: (Instant | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_reservation_impact_preview_v1".
 */
export interface ManagementProjectionReservationImpactPreviewV1 {
operation: "reservation_impact_preview_v1"
values: {
change?: ReservationProtectionChange
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PolicyProtectionChange".
 */
export interface PolicyProtectionChange {
kind: "policy"
key: PolicyKey
value: PolicyValue
effective_at: Instant
mandatory: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NegativeLimitProtectionChange".
 */
export interface NegativeLimitProtectionChange {
kind: "negative_limit"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
allowed_negative_credits: Count
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CreditProtectionChange".
 */
export interface CreditProtectionChange {
kind: "credit_adjust"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
quantity: PositiveInt
direction: Direction
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SaleScopeProtectionChange".
 */
export interface SaleScopeProtectionChange {
kind: "sale_scope"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
/**
 * @minItems 1
 */
scopes: [ProductScope, ...(ProductScope)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ValidityProtectionChange".
 */
export interface ValidityProtectionChange {
kind: "entitlement_extend"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
end_date: Date
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_reservation_impact_apply_v1".
 */
export interface ManagementProjectionReservationImpactApplyV1 {
operation: "reservation_impact_apply_v1"
values: {
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids?: string[]
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_settlement_request_submit_v1".
 */
export interface ManagementProjectionSettlementRequestSubmitV1 {
operation: "settlement_request_submit_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
from_center_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
to_center_id?: string
currency?: Currency
previous_id?: (string | null)
previous_version?: PositiveInt
proposal?: SettlementProposal
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementPaymentProposal".
 */
export interface SettlementPaymentProposal {
kind: "payment"
/**
 * @minItems 1
 */
lines: [SettlementLine, ...(SettlementLine)[]]
amount_minor: PositiveMoney
occurred_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementLine".
 */
export interface SettlementLine {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
movement_id: string
expected_version: PositiveInt
amount_minor: PositiveMoney
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementOffsetProposal".
 */
export interface SettlementOffsetProposal {
kind: "offset"
/**
 * @minItems 1
 */
debit_lines: [SettlementLine, ...(SettlementLine)[]]
/**
 * @minItems 1
 */
credit_lines: [SettlementLine, ...(SettlementLine)[]]
amount_minor: PositiveMoney
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementCorrectionProposal".
 */
export interface SettlementCorrectionProposal {
kind: "correction"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
original_record_id: string
expected_version: PositiveInt
amount_minor: PositiveMoney
/**
 * @minItems 1
 */
allocations: [SettlementCorrectionAllocation, ...(SettlementCorrectionAllocation)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementCorrectionAllocation".
 */
export interface SettlementCorrectionAllocation {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
allocation_id: string
expected_version: PositiveInt
amount_minor: PositiveMoney
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_settlement_request_withdraw_v1".
 */
export interface ManagementProjectionSettlementRequestWithdrawV1 {
operation: "settlement_request_withdraw_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_settlement_request_decide_v1".
 */
export interface ManagementProjectionSettlementRequestDecideV1 {
operation: "settlement_request_decide_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id?: string
decision?: ("approve" | "reject")
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_settlement_delegation_set_v1".
 */
export interface ManagementProjectionSettlementDelegationSetV1 {
operation: "settlement_delegation_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
granted?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_settlement_authority_set_v1".
 */
export interface ManagementProjectionSettlementAuthoritySetV1 {
operation: "settlement_authority_set_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
granted?: Bool
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_attendance_start_v1".
 */
export interface ManagementProjectionAttendanceStartV1 {
operation: "attendance_start_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
actual_started_at?: Instant
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_document_publication_preview_v1".
 */
export interface ManagementProjectionDocumentPublicationPreviewV1 {
operation: "document_publication_preview_v1"
values: {
document_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id?: string
version_label?: Text
requirements?: DocumentRequirement[]
scope?: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementProjection_reservation_capacity_override_v1".
 */
export interface ManagementProjectionReservationCapacityOverrideV1 {
operation: "reservation_capacity_override_v1"
values: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id?: string
source_sale_id?: (string | null)
mode?: BookingMode
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonRequestView".
 */
export interface LessonRequestView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
format: SessionFormat
requested_start: Instant
duration_minutes: Int
preferred_instructor_id?: (string | null)
state: RequestState
reservation_id?: (string | null)
expires_at?: (Instant | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
alternatives: LessonRequestAlternativeView[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "LessonRequestAlternativeView".
 */
export interface LessonRequestAlternativeView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
starts_at: Instant
ends_at: Instant
instructor_id?: (string | null)
state: AlternativeState
selected_at?: (Instant | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "WaitlistEntryView".
 */
export interface WaitlistEntryView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
joined_at: Instant
state: WaitState
offers: SeatOfferView[]
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SeatOfferView".
 */
export interface SeatOfferView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
created_at: Instant
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
entry_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
expires_at: Instant
state: OfferState
booking_category?: (BookingCategory | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReservationProtectionPreview".
 */
export interface ReservationProtectionPreview {
preview: Preview
change: ReservationProtectionChange
/**
 * @minItems 0
 */
affected: ProtectedObligationView[]
preserves_reservations: true
waives_independent_blocks: false
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementMovementView".
 */
export interface SettlementMovementView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debtor_center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
creditor_center_id: string
currency: Currency
amount_minor: PositiveMoney
open_minor: Money
kind: ("accrual" | "reversal" | "payment" | "offset" | "payment_reversal")
source_allocation_id: (string | null)
source_sale_id: (string | null)
previous_id: (string | null)
created_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementRecordView".
 */
export interface SettlementRecordView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
kind: ("payment" | "offset" | "correction")
amount_minor: PositiveMoney
currency: Currency
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
approved_by_account_id: string
original_record_id: (string | null)
created_at: Instant
/**
 * @minItems 1
 */
allocations: [SettlementRecordAllocationView, ...(SettlementRecordAllocationView)[]]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementRecordAllocationView".
 */
export interface SettlementRecordAllocationView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
movement_id: string
side: ("payment" | "debit" | "credit")
amount_minor: PositiveMoney
unreversed_minor: Money
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementSubmitAuthority".
 */
export interface SettlementSubmitAuthority {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
account_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
permission: "settlement.request"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
manager_role_id: string
manager_role_version: PositiveInt
settlement_grant_version: PositiveInt
checked_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementDecisionAuthority".
 */
export interface SettlementDecisionAuthority {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
account_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
permission: "settlement.decide"
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
manager_role_id: string
manager_role_version: PositiveInt
settlement_grant_version: PositiveInt
checked_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementMovementsPage".
 */
export interface SettlementMovementsPage {
/**
 * @minItems 0
 */
items: SettlementMovementView[]
next_cursor: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementRequestsPage".
 */
export interface SettlementRequestsPage {
/**
 * @minItems 0
 */
items: SettlementRequestView[]
next_cursor: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementCommandResult".
 */
export interface SettlementCommandResult {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
primary_id: string
version: PositiveInt
replayed: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementRuleSet".
 */
export interface SettlementRuleSet {
credit_basis: "actual_sale_price_per_consumed_credit"
earning_agreement: "service_center_actual_instructor_package_override_else_general"
accrual_trigger: "performed_session_and_right_consumed_or_later_eligible_credit_deficit_settlement"
cash_payment_required: false
timed_transfer: false
source_less_negative_initial_transfer: false
late_negative_earning_reprice: false
reversal: "linked_original_amount_preserving_prior_payments"
rounding: "half_away_from_zero_largest_remainder_stable_tie_original_amount_on_reversal"
scope_gate: "same_org_business_accessible_centers_and_source_sale_service_center_discipline_scope"
dependency_scope: "selected_movement_versions_request_authority_plan"
fallback_approval: "disabled_no_implicit_owner_or_org_manager_authority"
offset: "explicit_approved_same_currency_both_sides_atomic_no_auto_net_no_fx"
no_double_close: true
approval_finalizes_record_and_balances: true
separate_payment_recorder: false
automatic_bank_transfer: false
submit_closes_balance: false
same_account_allowed_with_both_center_authorities: true
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_profile_update_v1".
 */
export interface ManagementSelectorAccountProfileUpdateV1 {
operation: "account_profile_update_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_delete_preview_v1".
 */
export interface ManagementSelectorAccountDeletePreviewV1 {
operation: "account_delete_preview_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_delete_apply_v1".
 */
export interface ManagementSelectorAccountDeleteApplyV1 {
operation: "account_delete_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_create_v1".
 */
export interface ManagementSelectorOrganizationCreateV1 {
operation: "organization_create_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
verified_account_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
initial_plan_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_update_v1".
 */
export interface ManagementSelectorOrganizationUpdateV1 {
operation: "organization_update_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_close_preview_v1".
 */
export interface ManagementSelectorOrganizationClosePreviewV1 {
operation: "organization_close_preview_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_close_apply_v1".
 */
export interface ManagementSelectorOrganizationCloseApplyV1 {
operation: "organization_close_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_reopen_v1".
 */
export interface ManagementSelectorOrganizationReopenV1 {
operation: "organization_reopen_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_delete_preview_v1".
 */
export interface ManagementSelectorOrganizationDeletePreviewV1 {
operation: "organization_delete_preview_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_organization_delete_apply_v1".
 */
export interface ManagementSelectorOrganizationDeleteApplyV1 {
operation: "organization_delete_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_center_create_v1".
 */
export interface ManagementSelectorCenterCreateV1 {
operation: "center_create_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_center_update_v1".
 */
export interface ManagementSelectorCenterUpdateV1 {
operation: "center_update_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_room_save_v1".
 */
export interface ManagementSelectorRoomSaveV1 {
operation: "room_save_v1"
key: {
room_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_availability_save_v1".
 */
export interface ManagementSelectorAvailabilitySaveV1 {
operation: "availability_save_v1"
key: {
rule_id?: (string | null)
resource: ResourceRef
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_availability_exception_save_v1".
 */
export interface ManagementSelectorAvailabilityExceptionSaveV1 {
operation: "availability_exception_save_v1"
key: {
resource: ResourceRef
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_policy_publish_v1".
 */
export interface ManagementSelectorPolicyPublishV1 {
operation: "policy_publish_v1"
key: {
key: PolicyKey
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_role_assign_v1".
 */
export interface ManagementSelectorRoleAssignV1 {
operation: "role_assign_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
role: OperationalRole
scope: RoleScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_role_revoke_v1".
 */
export interface ManagementSelectorRoleRevokeV1 {
operation: "role_revoke_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
assignment_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_permission_set_v1".
 */
export interface ManagementSelectorPermissionSetV1 {
operation: "permission_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
permission: Permission
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_org_manager_assign_v1".
 */
export interface ManagementSelectorOrgManagerAssignV1 {
operation: "org_manager_assign_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_org_manager_revoke_v1".
 */
export interface ManagementSelectorOrgManagerRevokeV1 {
operation: "org_manager_revoke_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_manager_self_assign_center_v1".
 */
export interface ManagementSelectorManagerSelfAssignCenterV1 {
operation: "manager_self_assign_center_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_center_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_access_send_v1".
 */
export interface ManagementSelectorAccountAccessSendV1 {
operation: "account_access_send_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_access_revoke_v1".
 */
export interface ManagementSelectorAccountAccessRevokeV1 {
operation: "account_access_revoke_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
invitation_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_access_accept_v1".
 */
export interface ManagementSelectorAccountAccessAcceptV1 {
operation: "account_access_accept_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_account_link_remove_v1".
 */
export interface ManagementSelectorAccountLinkRemoveV1 {
operation: "account_link_remove_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
link_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_person_create_v1".
 */
export interface ManagementSelectorPersonCreateV1 {
operation: "person_create_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_person_update_v1".
 */
export interface ManagementSelectorPersonUpdateV1 {
operation: "person_update_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_student_activate_v1".
 */
export interface ManagementSelectorStudentActivateV1 {
operation: "student_activate_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_student_deactivate_v1".
 */
export interface ManagementSelectorStudentDeactivateV1 {
operation: "student_deactivate_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_person_merge_preview_v1".
 */
export interface ManagementSelectorPersonMergePreviewV1 {
operation: "person_merge_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
source_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_person_merge_approve_v1".
 */
export interface ManagementSelectorPersonMergeApproveV1 {
operation: "person_merge_approve_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
approval_center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_person_merge_apply_v1".
 */
export interface ManagementSelectorPersonMergeApplyV1 {
operation: "person_merge_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_class_save_v1".
 */
export interface ManagementSelectorClassSaveV1 {
operation: "class_save_v1"
key: {
class_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_program_preview_v1".
 */
export interface ManagementSelectorProgramPreviewV1 {
operation: "program_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_program_apply_v1".
 */
export interface ManagementSelectorProgramApplyV1 {
operation: "program_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_create_v1".
 */
export interface ManagementSelectorSessionCreateV1 {
operation: "session_create_v1"
key: {
class_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_change_preview_v1".
 */
export interface ManagementSelectorSessionChangePreviewV1 {
operation: "session_change_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
scope: ChangeScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_change_apply_v1".
 */
export interface ManagementSelectorSessionChangeApplyV1 {
operation: "session_change_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_capacity_set_v1".
 */
export interface ManagementSelectorSessionCapacitySetV1 {
operation: "session_capacity_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_cancel_preview_v1".
 */
export interface ManagementSelectorSessionCancelPreviewV1 {
operation: "session_cancel_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_cancel_apply_v1".
 */
export interface ManagementSelectorSessionCancelApplyV1 {
operation: "session_cancel_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_replacement_session_create_v1".
 */
export interface ManagementSelectorReplacementSessionCreateV1 {
operation: "replacement_session_create_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
replaces_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_session_assignment_set_v1".
 */
export interface ManagementSelectorSessionAssignmentSetV1 {
operation: "session_assignment_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
agreement_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lesson_request_create_v1".
 */
export interface ManagementSelectorLessonRequestCreateV1 {
operation: "lesson_request_create_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
preferred_instructor_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id?: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lesson_request_withdraw_v1".
 */
export interface ManagementSelectorLessonRequestWithdrawV1 {
operation: "lesson_request_withdraw_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lesson_request_reject_v1".
 */
export interface ManagementSelectorLessonRequestRejectV1 {
operation: "lesson_request_reject_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lesson_request_offer_alternative_v1".
 */
export interface ManagementSelectorLessonRequestOfferAlternativeV1 {
operation: "lesson_request_offer_alternative_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lesson_request_accept_alternative_v1".
 */
export interface ManagementSelectorLessonRequestAcceptAlternativeV1 {
operation: "lesson_request_accept_alternative_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
alternative_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lesson_request_approve_v1".
 */
export interface ManagementSelectorLessonRequestApproveV1 {
operation: "lesson_request_approve_v1"
key: {
session_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lesson_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_reservation_create_v1".
 */
export interface ManagementSelectorReservationCreateV1 {
operation: "reservation_create_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
source_sale_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_reservation_cancel_v1".
 */
export interface ManagementSelectorReservationCancelV1 {
operation: "reservation_cancel_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_waitlist_join_v1".
 */
export interface ManagementSelectorWaitlistJoinV1 {
operation: "waitlist_join_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_waitlist_leave_v1".
 */
export interface ManagementSelectorWaitlistLeaveV1 {
operation: "waitlist_leave_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
entry_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_seat_offer_accept_v1".
 */
export interface ManagementSelectorSeatOfferAcceptV1 {
operation: "seat_offer_accept_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_seat_offer_reject_v1".
 */
export interface ManagementSelectorSeatOfferRejectV1 {
operation: "seat_offer_reject_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_attendance_mark_v1".
 */
export interface ManagementSelectorAttendanceMarkV1 {
operation: "attendance_mark_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_attendance_close_v1".
 */
export interface ManagementSelectorAttendanceCloseV1 {
operation: "attendance_close_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_attendance_correct_preview_v1".
 */
export interface ManagementSelectorAttendanceCorrectPreviewV1 {
operation: "attendance_correct_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_attendance_correct_apply_v1".
 */
export interface ManagementSelectorAttendanceCorrectApplyV1 {
operation: "attendance_correct_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_product_publish_v1".
 */
export interface ManagementSelectorProductPublishV1 {
operation: "product_publish_v1"
key: {
product_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_preview_v1".
 */
export interface ManagementSelectorSalePreviewV1 {
operation: "sale_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_apply_v1".
 */
export interface ManagementSelectorSaleApplyV1 {
operation: "sale_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_entitlement_extend_v1".
 */
export interface ManagementSelectorEntitlementExtendV1 {
operation: "entitlement_extend_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_credit_adjust_v1".
 */
export interface ManagementSelectorCreditAdjustV1 {
operation: "credit_adjust_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_negative_limit_set_v1".
 */
export interface ManagementSelectorNegativeLimitSetV1 {
operation: "negative_limit_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_freeze_preview_v1".
 */
export interface ManagementSelectorFreezePreviewV1 {
operation: "freeze_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_freeze_apply_v1".
 */
export interface ManagementSelectorFreezeApplyV1 {
operation: "freeze_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_freeze_end_preview_v1".
 */
export interface ManagementSelectorFreezeEndPreviewV1 {
operation: "freeze_end_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
freeze_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_freeze_end_apply_v1".
 */
export interface ManagementSelectorFreezeEndApplyV1 {
operation: "freeze_end_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_terminate_preview_v1".
 */
export interface ManagementSelectorSaleTerminatePreviewV1 {
operation: "sale_terminate_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_terminate_apply_v1".
 */
export interface ManagementSelectorSaleTerminateApplyV1 {
operation: "sale_terminate_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_refund_preview_v1".
 */
export interface ManagementSelectorSaleRefundPreviewV1 {
operation: "sale_refund_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_refund_apply_v1".
 */
export interface ManagementSelectorSaleRefundApplyV1 {
operation: "sale_refund_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_change_preview_v1".
 */
export interface ManagementSelectorSaleChangePreviewV1 {
operation: "sale_change_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
new_product_version_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_change_apply_v1".
 */
export interface ManagementSelectorSaleChangeApplyV1 {
operation: "sale_change_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_renew_preview_v1".
 */
export interface ManagementSelectorSaleRenewPreviewV1 {
operation: "sale_renew_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
previous_sale_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_sale_renew_apply_v1".
 */
export interface ManagementSelectorSaleRenewApplyV1 {
operation: "sale_renew_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_collection_record_v1".
 */
export interface ManagementSelectorCollectionRecordV1 {
operation: "collection_record_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_collection_correct_preview_v1".
 */
export interface ManagementSelectorCollectionCorrectPreviewV1 {
operation: "collection_correct_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
cash_movement_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_collection_correct_apply_v1".
 */
export interface ManagementSelectorCollectionCorrectApplyV1 {
operation: "collection_correct_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_student_credit_refund_v1".
 */
export interface ManagementSelectorStudentCreditRefundV1 {
operation: "student_credit_refund_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_student_credit_offset_v1".
 */
export interface ManagementSelectorStudentCreditOffsetV1 {
operation: "student_credit_offset_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_debt_adjust_v1".
 */
export interface ManagementSelectorDebtAdjustV1 {
operation: "debt_adjust_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
debt_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_instructor_agreement_publish_v1".
 */
export interface ManagementSelectorInstructorAgreementPublishV1 {
operation: "instructor_agreement_publish_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
supersedes_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_instructor_payment_record_v1".
 */
export interface ManagementSelectorInstructorPaymentRecordV1 {
operation: "instructor_payment_record_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_instructor_payment_correct_v1".
 */
export interface ManagementSelectorInstructorPaymentCorrectV1 {
operation: "instructor_payment_correct_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lead_save_v1".
 */
export interface ManagementSelectorLeadSaveV1 {
operation: "lead_save_v1"
key: {
lead_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_crm_activity_save_v1".
 */
export interface ManagementSelectorCrmActivitySaveV1 {
operation: "crm_activity_save_v1"
key: (({
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
} | {
lead_id?: null
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}) & {
lead_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
activity_id?: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id?: string
})
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_trial_offer_create_v1".
 */
export interface ManagementSelectorTrialOfferCreateV1 {
operation: "trial_offer_create_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
product_version_id: string
session_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_trial_registration_confirm_v1".
 */
export interface ManagementSelectorTrialRegistrationConfirmV1 {
operation: "trial_registration_confirm_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
offer_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_lead_convert_v1".
 */
export interface ManagementSelectorLeadConvertV1 {
operation: "lead_convert_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
lead_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_segment_save_v1".
 */
export interface ManagementSelectorSegmentSaveV1 {
operation: "segment_save_v1"
key: {
segment_id?: (string | null)
scope: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_automation_save_v1".
 */
export interface ManagementSelectorAutomationSaveV1 {
operation: "automation_save_v1"
key: {
automation_id?: (string | null)
scope: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_notification_mark_read_v1".
 */
export interface ManagementSelectorNotificationMarkReadV1 {
operation: "notification_mark_read_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
notification_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_notification_preferences_set_v1".
 */
export interface ManagementSelectorNotificationPreferencesSetV1 {
operation: "notification_preferences_set_v1"
key: {
channel: NotificationChannel
purpose: NotificationPurpose
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_report_export_start_v1".
 */
export interface ManagementSelectorReportExportStartV1 {
operation: "report_export_start_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_import_upload_prepare_v1".
 */
export interface ManagementSelectorImportUploadPrepareV1 {
operation: "import_upload_prepare_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_import_preview_v1".
 */
export interface ManagementSelectorImportPreviewV1 {
operation: "import_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_import_apply_v1".
 */
export interface ManagementSelectorImportApplyV1 {
operation: "import_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_subscription_upgrade_quote_v1".
 */
export interface ManagementSelectorSubscriptionUpgradeQuoteV1 {
operation: "subscription_upgrade_quote_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_subscription_downgrade_request_v1".
 */
export interface ManagementSelectorSubscriptionDowngradeRequestV1 {
operation: "subscription_downgrade_request_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
target_plan_id: string
kept_center_id?: (string | null)
kept_scope?: StarterRetainedScope
expected_version?: PositiveInt
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_subscription_change_cancel_v1".
 */
export interface ManagementSelectorSubscriptionChangeCancelV1 {
operation: "subscription_change_cancel_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
change_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_subscription_renewal_set_v1".
 */
export interface ManagementSelectorSubscriptionRenewalSetV1 {
operation: "subscription_renewal_set_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_saas_payment_submit_v1".
 */
export interface ManagementSelectorSaasPaymentSubmitV1 {
operation: "saas_payment_submit_v1"
key: {
quote_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_saas_payment_verify_v1".
 */
export interface ManagementSelectorSaasPaymentVerifyV1 {
operation: "saas_payment_verify_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
payment_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_saas_grace_extend_v1".
 */
export interface ManagementSelectorSaasGraceExtendV1 {
operation: "saas_grace_extend_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_save_v1".
 */
export interface ManagementSelectorEventSaveV1 {
operation: "event_save_v1"
key: {
event_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_publish_v1".
 */
export interface ManagementSelectorEventPublishV1 {
operation: "event_publish_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_register_v1".
 */
export interface ManagementSelectorEventRegisterV1 {
operation: "event_register_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
sale_id?: (string | null)
preparation_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_registration_cancel_v1".
 */
export interface ManagementSelectorEventRegistrationCancelV1 {
operation: "event_registration_cancel_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_complete_v1".
 */
export interface ManagementSelectorEventCompleteV1 {
operation: "event_complete_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_duty_verify_v1".
 */
export interface ManagementSelectorEventDutyVerifyV1 {
operation: "event_duty_verify_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
assignment_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_cancel_preview_v1".
 */
export interface ManagementSelectorEventCancelPreviewV1 {
operation: "event_cancel_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_cancel_apply_v1".
 */
export interface ManagementSelectorEventCancelApplyV1 {
operation: "event_cancel_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_document_upload_prepare_v1".
 */
export interface ManagementSelectorDocumentUploadPrepareV1 {
operation: "document_upload_prepare_v1"
key: {

}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_document_version_publish_v1".
 */
export interface ManagementSelectorDocumentVersionPublishV1 {
operation: "document_version_publish_v1"
key: {
document_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
scope: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_document_accept_v1".
 */
export interface ManagementSelectorDocumentAcceptV1 {
operation: "document_accept_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
document_version_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_publication_set_v1".
 */
export interface ManagementSelectorPublicationSetV1 {
operation: "publication_set_v1"
key: {
session_id?: (string | null)
event_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_public_application_submit_v1".
 */
export interface ManagementSelectorPublicApplicationSubmitV1 {
operation: "public_application_submit_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
publication_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_public_application_review_v1".
 */
export interface ManagementSelectorPublicApplicationReviewV1 {
operation: "public_application_review_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
application_id?: string
person_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_class_assignment_set_v1".
 */
export interface ManagementSelectorClassAssignmentSetV1 {
operation: "class_assignment_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
class_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
duty: Duty
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_attendance_mark_v1".
 */
export interface ManagementSelectorEventAttendanceMarkV1 {
operation: "event_attendance_mark_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_platform_owner_set_v1".
 */
export interface ManagementSelectorPlatformOwnerSetV1 {
operation: "platform_owner_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
verified_account_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_platform_owner_remove_v1".
 */
export interface ManagementSelectorPlatformOwnerRemoveV1 {
operation: "platform_owner_remove_v1"
key: {
replacement_verified_account_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_center_manager_assign_v1".
 */
export interface ManagementSelectorCenterManagerAssignV1 {
operation: "center_manager_assign_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_center_manager_revoke_v1".
 */
export interface ManagementSelectorCenterManagerRevokeV1 {
operation: "center_manager_revoke_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_attendance_block_v1".
 */
export interface ManagementSelectorAttendanceBlockV1 {
operation: "attendance_block_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
reservation_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_attendance_close_v1".
 */
export interface ManagementSelectorEventAttendanceCloseV1 {
operation: "event_attendance_close_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_attendance_correct_v1".
 */
export interface ManagementSelectorEventAttendanceCorrectV1 {
operation: "event_attendance_correct_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
registration_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_file_upload_complete_v1".
 */
export interface ManagementSelectorFileUploadCompleteV1 {
operation: "file_upload_complete_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_negcredit_valuation_set_v1".
 */
export interface ManagementSelectorNegcreditValuationSetV1 {
operation: "negcredit_valuation_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
format: SessionFormat
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_discipline_save_v1".
 */
export interface ManagementSelectorDisciplineSaveV1 {
operation: "discipline_save_v1"
key: {
discipline_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_center_discipline_set_v1".
 */
export interface ManagementSelectorCenterDisciplineSetV1 {
operation: "center_discipline_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_person_discipline_set_v1".
 */
export interface ManagementSelectorPersonDisciplineSetV1 {
operation: "person_discipline_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_registration_preview_v1".
 */
export interface ManagementSelectorEventRegistrationPreviewV1 {
operation: "event_registration_preview_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
sale_id?: (string | null)
preparation_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_payment_prepare_v1".
 */
export interface ManagementSelectorEventPaymentPrepareV1 {
operation: "event_payment_prepare_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_actual_start_record_v1".
 */
export interface ManagementSelectorEventActualStartRecordV1 {
operation: "event_actual_start_record_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_event_actual_start_correct_v1".
 */
export interface ManagementSelectorEventActualStartCorrectV1 {
operation: "event_actual_start_correct_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
event_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_reservation_impact_preview_v1".
 */
export interface ManagementSelectorReservationImpactPreviewV1 {
operation: "reservation_impact_preview_v1"
key: {
change: ReservationProtectionChange
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_reservation_impact_apply_v1".
 */
export interface ManagementSelectorReservationImpactApplyV1 {
operation: "reservation_impact_apply_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
preview_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settlement_request_submit_v1".
 */
export interface ManagementSelectorSettlementRequestSubmitV1 {
operation: "settlement_request_submit_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
from_center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
to_center_id: string
previous_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settlement_request_withdraw_v1".
 */
export interface ManagementSelectorSettlementRequestWithdrawV1 {
operation: "settlement_request_withdraw_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settlement_request_decide_v1".
 */
export interface ManagementSelectorSettlementRequestDecideV1 {
operation: "settlement_request_decide_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settlement_delegation_set_v1".
 */
export interface ManagementSelectorSettlementDelegationSetV1 {
operation: "settlement_delegation_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settlement_authority_set_v1".
 */
export interface ManagementSelectorSettlementAuthoritySetV1 {
operation: "settlement_authority_set_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_attendance_start_v1".
 */
export interface ManagementSelectorAttendanceStartV1 {
operation: "attendance_start_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_document_publication_preview_v1".
 */
export interface ManagementSelectorDocumentPublicationPreviewV1 {
operation: "document_publication_preview_v1"
key: {
document_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
scope: ConfigurationScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settings_update_v1".
 */
export interface ManagementSelectorSettingsUpdateV1 {
operation: "settings_update_v1"
key: {
scope: SettingsScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settings_reset_preview_v1".
 */
export interface ManagementSelectorSettingsResetPreviewV1 {
operation: "settings_reset_preview_v1"
key: {
scope: SettingsScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_settings_reset_apply_v1".
 */
export interface ManagementSelectorSettingsResetApplyV1 {
operation: "settings_reset_apply_v1"
key: {
scope: SettingsScope
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementSelector_reservation_capacity_override_v1".
 */
export interface ManagementSelectorReservationCapacityOverrideV1 {
operation: "reservation_capacity_override_v1"
key: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
source_sale_id?: (string | null)
}
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_management_state_get".
 */
export interface SuccessManagementStateGet {
ok: true
data: ManagementStatePage
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ManagementStatePage".
 */
export interface ManagementStatePage {
items: ManagementStateView[]
next_cursor: (OpaqueToken | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_instructor_agreements_list".
 */
export interface RequestInstructorAgreementsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_instructor_agreements_list".
 */
export interface SuccessInstructorAgreementsList {
ok: true
data: AgreementVersionPage
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reservation_impact_preview".
 */
export interface RequestReservationImpactPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
change: ReservationProtectionChange
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reservation_impact_preview".
 */
export interface SuccessReservationImpactPreview {
ok: true
data: ReservationProtectionPreview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reservation_impact_apply".
 */
export interface RequestReservationImpactApply {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
preview: PreviewToken
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
accepted_reservation_ids: string[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reservation_impact_apply".
 */
export interface SuccessReservationImpactApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_movements_list".
 */
export interface RequestSettlementMovementsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
page: Page
currency: Currency
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_movements_list".
 */
export interface SuccessSettlementMovementsList {
ok: true
data: SettlementMovementsPage
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_requests_list".
 */
export interface RequestSettlementRequestsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_requests_list".
 */
export interface SuccessSettlementRequestsList {
ok: true
data: SettlementRequestsPage
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_request_get".
 */
export interface RequestSettlementRequestGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_request_get".
 */
export interface SuccessSettlementRequestGet {
ok: true
data: SettlementRequestView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_request_submit".
 */
export interface SuccessSettlementRequestSubmit {
ok: true
data: SettlementCommandResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_request_withdraw".
 */
export interface RequestSettlementRequestWithdraw {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id: string
expected_version: PositiveInt
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_request_withdraw".
 */
export interface SuccessSettlementRequestWithdraw {
ok: true
data: SettlementCommandResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_request_decide".
 */
export interface RequestSettlementRequestDecide {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
settlement_request_id: string
expected_version: PositiveInt
decision: ("approve" | "reject")
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_request_decide".
 */
export interface SuccessSettlementRequestDecide {
ok: true
data: SettlementCommandResult
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Target_center_update_identified".
 */
export interface TargetCenterUpdateIdentified {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
name: Text
timezone: IanaZone
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementCenterGrantView".
 */
export interface SettlementCenterGrantView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
granted: Bool
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettlementAuthorityView".
 */
export interface SettlementAuthorityView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
version: PositiveInt
delegation_allowed: Bool
center_grants: SettlementCenterGrantView[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_authority_get".
 */
export interface RequestSettlementAuthorityGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
center_id?: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_delegation_set".
 */
export interface RequestSettlementDelegationSet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
expected_version: PositiveInt
granted: Bool
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_settlement_authority_set".
 */
export interface RequestSettlementAuthoritySet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
expected_version: PositiveInt
granted: Bool
reason: Text
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_authority_get".
 */
export interface SuccessSettlementAuthorityGet {
ok: true
data: SettlementAuthorityView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_delegation_set".
 */
export interface SuccessSettlementDelegationSet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settlement_authority_set".
 */
export interface SuccessSettlementAuthoritySet {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_negative_limits_get".
 */
export interface RequestNegativeLimitsGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "NegativeLimitsView".
 */
export interface NegativeLimitsView {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
discipline_id: string
version: PositiveInt
override: (Count | null)
default_limit: (Count | null)
upper_limit: (Count | null)
effective_limit: (Count | null)
reserved_deficit: Count
consumed_deficit: Count
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
policy_version_ids: string[]
override_version: (PositiveInt | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_negative_limits_get".
 */
export interface SuccessNegativeLimitsGet {
ok: true
data: NegativeLimitsView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_attendance_start".
 */
export interface RequestAttendanceStart {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
expected_version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
actual_started_at: Instant
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_attendance_start".
 */
export interface SuccessAttendanceStart {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_document_publication_preview".
 */
export interface RequestDocumentPublicationPreview {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
document_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
file_id: string
version_label: Text
requirements: DocumentRequirement[]
scope: ConfigurationScope
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "DocumentPublicationAffected".
 */
export interface DocumentPublicationAffected {
subject: EntityRef
version: PositiveInt
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_document_publication_preview".
 */
export interface SuccessDocumentPublicationPreview {
ok: true
data: {
preview: Preview
affected: DocumentPublicationAffected[]
preserves_reservations: true
}
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "UserSettingsValues".
 */
export interface UserSettingsValues {
honorific?: string
language?: ("auto" | "tr" | "en")
date_format?: "dd.MM.yyyy"
time_format?: ("12" | "24")
number_format?: ("tr-TR" | "en-US")
week_start?: ("monday" | "sunday")
timezone_mode?: ("auto" | "manual")
theme?: ("light" | "dark" | "system")
contrast?: ("system" | "high")
motion?: ("system" | "reduced")
remember_context?: boolean
calendar_view?: ("day" | "week" | "month" | "agenda")
show_weekends?: boolean
marketing_in_app?: boolean
ad_personalization?: boolean
ad_measurement?: boolean
optional_analytics?: boolean
timezone_name?: (string | null)
font_scale?: (number | null)
startup_context?: ({
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id: (string | null)
discipline_id: (string | null)
} | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "MemberSettingsValues".
 */
export interface MemberSettingsValues {
profile_visible?: boolean
photo_visible?: boolean
email_visible?: boolean
phone_visible?: boolean
history_recommendations?: boolean
/**
 * @maxItems 100
 *
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
interest_center_ids?: string[]
/**
 * @maxItems 100
 *
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
interest_discipline_ids?: string[]
in_app_reminders?: boolean
in_app_marketing?: boolean
/**
 * @maxItems 100
 */
report_templates?: {
key: string
name: string
report: ("collections_debts" | "lesson_attendance")
filters: {
interval: {
starts_at: string
ends_at: string
}
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_ids: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_ids?: string[]
currency?: (string | null)
state?: (string | null)
}
/**
 * @minItems 1
 * @maxItems 9
 */
columns: [("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]
report_order: ("group_key_asc" | "group_key_desc")
group_by: ("person" | "center" | "total")
}[]
/**
 * @maxItems 100
 */
import_templates?: {
key: string
name: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
mapping: {
columns: {
source_column: string
target: ("display_name" | "email" | "phone" | "source_key" | "person_ref" | "opening_credits" | "opening_debt_minor" | "currency" | "product_version_ref" | "start_date" | "end_date" | "opening_credit_value_minor")
}[]
delimiter: ("," | ";")
}
source_namespace: string
}[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "CenterSettingsValues".
 */
export interface CenterSettingsValues {
description?: string
address?: string
contact_phone?: string
contact_email?: (string | null)
program_duration_minutes?: number
/**
 * @maxItems 100
 */
report_templates?: {
key: string
name: string
report: ("collections_debts" | "lesson_attendance")
filters: {
interval: {
starts_at: string
ends_at: string
}
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_ids: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_ids?: string[]
currency?: (string | null)
state?: (string | null)
}
/**
 * @minItems 1
 * @maxItems 9
 */
columns: [("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]
report_order: ("group_key_asc" | "group_key_desc")
group_by: ("person" | "center" | "total")
}[]
/**
 * @maxItems 100
 */
import_templates?: {
key: string
name: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
mapping: {
columns: {
source_column: string
target: ("display_name" | "email" | "phone" | "source_key" | "person_ref" | "opening_credits" | "opening_debt_minor" | "currency" | "product_version_ref" | "start_date" | "end_date" | "opening_credit_value_minor")
}[]
delimiter: ("," | ";")
}
source_namespace: string
}[]
public_profile_enabled?: boolean
/**
 * @maxItems 6
 */
public_fields?: []|[("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]
/**
 * @maxItems 100
 */
public_hours?: {
/**
 * @minItems 1
 * @maxItems 7
 */
weekdays: [number]|[number, number]|[number, number, number]|[number, number, number, number]|[number, number, number, number, number]|[number, number, number, number, number, number]|[number, number, number, number, number, number, number]
local_start: string
local_end: string
timezone: string
}[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "OrganizationSettingsValues".
 */
export interface OrganizationSettingsValues {
description?: string
address?: string
contact_phone?: string
contact_email?: (string | null)
theme_package_id?: null
font_package_id?: null
billing_name?: string
billing_address?: string
billing_email?: (string | null)
program_duration_minutes?: number
/**
 * @maxItems 100
 */
report_templates?: {
key: string
name: string
report: ("collections_debts" | "lesson_attendance")
filters: {
interval: {
starts_at: string
ends_at: string
}
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_ids: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_ids?: string[]
currency?: (string | null)
state?: (string | null)
}
/**
 * @minItems 1
 * @maxItems 9
 */
columns: [("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]|[("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count"), ("group_key" | "center_id" | "person_id" | "currency" | "count" | "amount_minor" | "credits" | "ratio_bps" | "basis_count")]
report_order: ("group_key_asc" | "group_key_desc")
group_by: ("person" | "center" | "total")
}[]
/**
 * @maxItems 100
 */
import_templates?: {
key: string
name: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
mapping: {
columns: {
source_column: string
target: ("display_name" | "email" | "phone" | "source_key" | "person_ref" | "opening_credits" | "opening_debt_minor" | "currency" | "product_version_ref" | "start_date" | "end_date" | "opening_credit_value_minor")
}[]
delimiter: ("," | ";")
}
source_namespace: string
}[]
public_profile_enabled?: boolean
/**
 * @maxItems 6
 */
public_fields?: []|[("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]|[("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours"), ("name" | "description" | "logo" | "address" | "contact" | "hours")]
/**
 * @maxItems 100
 */
public_hours?: {
/**
 * @minItems 1
 * @maxItems 7
 */
weekdays: [number]|[number, number]|[number, number, number]|[number, number, number, number]|[number, number, number, number, number]|[number, number, number, number, number, number]|[number, number, number, number, number, number, number]
local_start: string
local_end: string
timezone: string
}[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PlatformSettingsValues".
 */
export interface PlatformSettingsValues {
application_name?: string
support_email?: (string | null)
support_url?: (string | null)
maintenance_message?: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsResetPreview".
 */
export interface SettingsResetPreview {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
token: string
scope: SettingsScope
version: SettingsVersion
before: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
after: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
fields: SettingsFieldKeys
expires_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsHistoryItem".
 */
export interface SettingsHistoryItem {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
actor_account_id: string
at: Instant
before: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
after: (UserSettingsValues | MemberSettingsValues | CenterSettingsValues | OrganizationSettingsValues | PlatformSettingsValues)
reason: string
media_change?: (SettingsMediaChange | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsMediaChange".
 */
export interface SettingsMediaChange {
before_asset_id: (string | null)
after_asset_id: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsHistory".
 */
export interface SettingsHistory {
/**
 * @maxItems 50
 */
items: SettingsHistoryItem[]
next_cursor: (string | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "SettingsFieldDescriptor".
 */
export interface SettingsFieldDescriptor {
key: ("ad_measurement" | "ad_personalization" | "address" | "application_name" | "billing_address" | "billing_email" | "billing_name" | "calendar_view" | "contact_email" | "contact_phone" | "contrast" | "date_format" | "description" | "email_visible" | "font_package_id" | "font_scale" | "history_recommendations" | "honorific" | "in_app_marketing" | "in_app_reminders" | "interest_center_ids" | "interest_discipline_ids" | "language" | "maintenance_message" | "marketing_in_app" | "motion" | "number_format" | "optional_analytics" | "phone_visible" | "photo_visible" | "profile_visible" | "program_duration_minutes" | "remember_context" | "show_weekends" | "startup_context" | "support_email" | "support_url" | "theme" | "theme_package_id" | "time_format" | "timezone_mode" | "timezone_name" | "week_start" | "report_templates" | "import_templates" | "public_profile_enabled" | "public_fields" | "public_hours")
group: string
consumer: ("frontend" | "p05_optional_allowed" | "new_center_copy" | "schedule_build_program" | "p06_report_prepare" | "p06_import_prepare" | "public_profile")
writable: boolean
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "WorkTemplates".
 */
export interface WorkTemplates {
/**
 * @maxItems 300
 */
reports: {
source: WorkTemplateReference
template: StarterReportTemplate
}[]
/**
 * @maxItems 300
 */
imports: {
source: WorkTemplateReference
template: StarterImportTemplate
}[]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "StarterReportTemplate".
 */
export interface StarterReportTemplate {
key: string
name: string
report: ("collections_debts" | "lesson_attendance")
filters: ReportFilters
columns: ReportColumns
report_order: ReportPreparationOrder
group_by: ReportPreparationGrouping
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "StarterImportTemplate".
 */
export interface StarterImportTemplate {
key: string
name: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
mapping: {
columns: ImportColumn[]
delimiter: ("," | ";")
}
source_namespace: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_catalog_get".
 */
export interface SuccessSettingsCatalogGet {
ok: true
data: SettingsCatalog
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_get".
 */
export interface SuccessSettingsGet {
ok: true
data: SettingsView
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_update".
 */
export interface SuccessSettingsUpdate {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_reset_preview".
 */
export interface SuccessSettingsResetPreview {
ok: true
data: SettingsResetPreview
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_reset_apply".
 */
export interface SuccessSettingsResetApply {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_history_get".
 */
export interface SuccessSettingsHistoryGet {
ok: true
data: SettingsHistory
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_reservation_capacity_override".
 */
export interface RequestReservationCapacityOverride {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
center_id?: (string | null)
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
session_id: string
source_sale_id?: (string | null)
mode: BookingMode
booking_category?: BookingCategory
reason: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_reservation_capacity_override".
 */
export interface SuccessReservationCapacityOverride {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountSessionView".
 */
export interface AccountSessionView {
/**
 * Provider-owned UUID; preserve version and value.
 */
session_id: string
current: boolean
created_at: Instant
last_refreshed_at: Instant
expires_at: (Instant | null)
aal: (("aal1" | "aal2") | null)
user_agent: (string | null)
label: (string | null)
version: SettingsVersion
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountSecurityEvent".
 */
export interface AccountSecurityEvent {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
at: Instant
action: ("session_labelled" | "session_revoked" | "other_sessions_revoked" | "totp_enabled" | "totp_disabled" | "email_changed" | "phone_changed" | "identity_linked" | "identity_unlinked")
session_id: (string | null)
affected_count: number
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountSessionPage".
 */
export interface AccountSessionPage {
/**
 * @maxItems 50
 */
items: AccountSessionView[]
next_cursor: (string | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountSecurityHistory".
 */
export interface AccountSecurityHistory {
/**
 * @maxItems 50
 */
items: AccountSecurityEvent[]
next_cursor: (string | null)
as_of: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountSessionRevocation".
 */
export interface AccountSessionRevocation {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
affected_count: number
current_revoked: boolean
replayed: boolean
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_sessions_list".
 */
export interface RequestAccountSessionsList {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
cursor?: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_sessions_list".
 */
export interface SuccessAccountSessionsList {
ok: true
data: AccountSessionPage
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_session_label".
 */
export interface RequestAccountSessionLabel {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Provider-owned UUID; preserve version and value.
 */
session_id: string
expected_version: SettingsVersion
label: (string | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_session_label".
 */
export interface SuccessAccountSessionLabel {
ok: true
data: Mutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_sessions_revoke".
 */
export interface SuccessAccountSessionsRevoke {
ok: true
data: AccountSessionRevocation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_security_history_get".
 */
export interface RequestAccountSecurityHistoryGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
cursor?: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_security_history_get".
 */
export interface SuccessAccountSecurityHistoryGet {
ok: true
data: AccountSecurityHistory
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_totp_remove".
 */
export interface RequestAccountTotpRemove {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Provider-owned UUID; preserve version and value.
 */
factor_id: string
reauth: ReauthProof
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "AccountTotpRemoval".
 */
export interface AccountTotpRemoval {
/**
 * Provider-owned UUID; preserve version and value.
 */
factor_id: string
removed: true
provider: "supabase_auth"
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_totp_remove".
 */
export interface SuccessAccountTotpRemove {
ok: true
data: AccountTotpRemoval
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_account_google_link_prepare".
 */
export interface RequestAccountGoogleLinkPrepare {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
reauth: ReauthProof
google_id_token: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "GoogleLinkAuthorization".
 */
export interface GoogleLinkAuthorization {
provider: "google"
status: "ready"
expires_in: 10
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_account_google_link_prepare".
 */
export interface SuccessAccountGoogleLinkPrepare {
ok: true
data: GoogleLinkAuthorization
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_media_get".
 */
export interface SuccessMediaGet {
ok: true
data: SettingsMediaContent
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportFilterOverrides".
 */
export interface ReportFilterOverrides {
interval?: Interval
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_ids?: string[]
/**
 * Items: Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
person_ids?: string[]
currency?: (Currency | null)
state?: (Text | null)
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ReportTemplateOverrides".
 */
export interface ReportTemplateOverrides {
filters?: ReportFilterOverrides
columns?: ReportColumns
report_order?: ReportPreparationOrder
group_by?: ReportPreparationGrouping
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "ImportTemplateOverrides".
 */
export interface ImportTemplateOverrides {
mapping?: ImportMapping
source_namespace?: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PreparedReportRequest".
 */
export interface PreparedReportRequest {
center_id?: (string | null)
report: ("collections_debts" | "lesson_attendance")
filters: ReportFilters
columns: ReportColumns
report_order: ReportPreparationOrder
group_by: ReportPreparationGrouping
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PreparedImportRequest".
 */
export interface PreparedImportRequest {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
center_id: string
mapping: ImportMapping
source_namespace: Text
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_settings_template_resolve".
 */
export interface SuccessSettingsTemplateResolve {
ok: true
data: ResolvedWorkTemplate
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonalCalendarLink".
 */
export interface PersonalCalendarLink {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
/**
 * @minItems 1
 * @maxItems 2
 */
kinds: [("lessons" | "duties")]|[("lessons" | "duties"), ("lessons" | "duties")]
state: ("active" | "revoked")
version: PositiveInt
created_at: Instant
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonalCalendarMutation".
 */
export interface PersonalCalendarMutation {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
primary_id: string
version?: PositiveInt
replayed: Bool
related: EntityRef[]
link: PersonalCalendarLink
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonalCalendarCredentialMutation".
 */
export interface PersonalCalendarCredentialMutation {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
primary_id: string
version?: PositiveInt
replayed: Bool
related: EntityRef[]
link: PersonalCalendarLink
subscription_url: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Page_PersonalCalendarLink".
 */
export interface Page_PersonalCalendarLink {
items: PersonalCalendarLink[]
next_cursor?: (OpaqueToken | null)
as_of: Instant
service_ready: boolean
/**
 * @maxItems 2
 */
supported_kinds: []|[("lessons" | "duties")]|[("lessons" | "duties"), ("lessons" | "duties")]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_calendar_links_get".
 */
export interface RequestCalendarLinksGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
page: Page
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_calendar_link_create".
 */
export interface RequestCalendarLinkCreate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
organization_scope: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
}
/**
 * @minItems 1
 * @maxItems 2
 */
kinds: [("lessons" | "duties")]|[("lessons" | "duties"), ("lessons" | "duties")]
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_calendar_link_rotate".
 */
export interface RequestCalendarLinkRotate {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
organization_scope: {
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
org_id: string
}
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
link_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_calendar_link_revoke".
 */
export interface RequestCalendarLinkRevoke {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
operation_key: string
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
link_id: string
expected_version: PositiveInt
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Request_calendar_feed_get".
 */
export interface RequestCalendarFeedGet {
client_api_version: 1
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
request_id: string
token: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "PersonalCalendarFeed".
 */
export interface PersonalCalendarFeed {
ics_base64: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_calendar_links_get".
 */
export interface SuccessCalendarLinksGet {
ok: true
data: Page_PersonalCalendarLink
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_calendar_link_create".
 */
export interface SuccessCalendarLinkCreate {
ok: true
data: PersonalCalendarCredentialMutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_calendar_link_rotate".
 */
export interface SuccessCalendarLinkRotate {
ok: true
data: PersonalCalendarCredentialMutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_calendar_link_revoke".
 */
export interface SuccessCalendarLinkRevoke {
ok: true
data: PersonalCalendarMutation
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
/**
 * This interface was referenced by `FtkSaaSDomainAPIContract22AcceptedDisciplineAndUUIDv7Amendments`'s JSON-Schema
 * via the `definition` "Success_calendar_feed_get".
 */
export interface SuccessCalendarFeedGet {
ok: true
data: PersonalCalendarFeed
/**
 * Domain/reference UUID. New FtkSaaS production MUST use UUIDv7; pre-existing UUID input is preserved.
 */
trace_id: string
}
