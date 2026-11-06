-- Cho phép app_user cập nhật vòng đời đề xuất AI trên audit_logs (Luật 3, Luật 8)
-- mà không cần app_system/BYPASSRLS và không nới lỏng RLS.
--
-- Chỉ cấp UPDATE các cột trạng thái/kết quả; trigger chặn mọi thay đổi ngoài
-- vòng đời PROPOSED -> CONFIRMED/REJECTED -> EXECUTED/FAILED và chặn sửa
-- các trường nhận dạng/ngữ cảnh của bản ghi audit.

CREATE OR REPLACE FUNCTION guard_ai_proposal_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Các role hệ thống khác (app_system, owner) giữ nguyên hành vi cũ.
  IF current_user <> 'app_user' THEN
    RETURN NEW;
  END IF;

  IF OLD.source <> 'AI' THEN
    RAISE EXCEPTION 'audit_logs: app_user chỉ được cập nhật đề xuất AI';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.action_type IS DISTINCT FROM OLD.action_type
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.payload - 'result' - 'error') IS DISTINCT FROM (NEW.payload - 'result' - 'error')
  THEN
    RAISE EXCEPTION 'audit_logs: không được sửa trường bất biến';
  END IF;

  IF OLD.status = 'PROPOSED'
     AND NEW.status IN ('CONFIRMED', 'REJECTED')
     AND NEW.confirmed_at IS NOT NULL
     AND NEW.executed_at IS NULL
  THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'CONFIRMED'
     AND NEW.status IN ('EXECUTED', 'FAILED')
     AND NEW.executed_at IS NOT NULL
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_logs: chuyển trạng thái đề xuất AI không hợp lệ';
END;
$$;

CREATE OR REPLACE TRIGGER audit_logs_ai_transition_guard
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION guard_ai_proposal_transition();

-- Bảng đã bị REVOKE UPDATE ở migration đầu; cấp lại đúng các cột vòng đời đề xuất.
GRANT UPDATE (status, confirmed_at, executed_at, payload) ON TABLE "audit_logs" TO app_user;
