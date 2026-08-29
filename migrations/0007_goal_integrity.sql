PRAGMA foreign_keys = ON;

DROP TRIGGER goal_version_immutable;
CREATE TRIGGER goal_version_immutable BEFORE UPDATE ON goal_versions
WHEN OLD.status IN ('CONFIRMED','SUPERSEDED')
 AND NOT (OLD.status='CONFIRMED' AND NEW.status='SUPERSEDED'
          AND OLD.id=NEW.id AND OLD.goal_id=NEW.goal_id AND OLD.version_no=NEW.version_no
          AND OLD.entry_route=NEW.entry_route AND OLD.title=NEW.title AND OLD.description=NEW.description
          AND OLD.target_date IS NEW.target_date AND OLD.success_criteria=NEW.success_criteria
          AND OLD.review_cycle IS NEW.review_cycle AND OLD.change_reason IS NEW.change_reason
          AND OLD.provenance_type=NEW.provenance_type AND OLD.confidentiality=NEW.confidentiality
          AND OLD.visibility=NEW.visibility AND OLD.ai_send_policy=NEW.ai_send_policy
          AND OLD.created_by=NEW.created_by AND OLD.confirmed_at IS NEW.confirmed_at AND OLD.created_at=NEW.created_at)
BEGIN SELECT RAISE(ABORT,'published goal version immutable'); END;

CREATE TRIGGER goal_parent_integrity_update BEFORE UPDATE OF parent_goal_id,member_id,unit_id ON goals
WHEN NEW.parent_goal_id IS NOT NULL BEGIN
 SELECT CASE WHEN NEW.parent_goal_id=NEW.id OR NOT EXISTS(
   SELECT 1 FROM goals p WHERE p.id=NEW.parent_goal_id AND p.member_id=NEW.member_id AND p.unit_id=NEW.unit_id
 ) THEN RAISE(ABORT,'goal parent mismatch') END;
END;
CREATE TRIGGER goal_parent_cycle_insert BEFORE INSERT ON goals WHEN NEW.parent_goal_id IS NOT NULL BEGIN
 WITH RECURSIVE ancestors(id) AS (
   SELECT NEW.parent_goal_id UNION ALL SELECT g.parent_goal_id FROM goals g JOIN ancestors a ON g.id=a.id WHERE g.parent_goal_id IS NOT NULL
 ) SELECT CASE WHEN EXISTS(SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE(ABORT,'goal parent cycle') END;
END;
CREATE TRIGGER goal_parent_cycle_update BEFORE UPDATE OF parent_goal_id ON goals WHEN NEW.parent_goal_id IS NOT NULL BEGIN
 WITH RECURSIVE ancestors(id) AS (
   SELECT NEW.parent_goal_id UNION ALL SELECT g.parent_goal_id FROM goals g JOIN ancestors a ON g.id=a.id WHERE g.parent_goal_id IS NOT NULL
 ) SELECT CASE WHEN EXISTS(SELECT 1 FROM ancestors WHERE id=NEW.id) THEN RAISE(ABORT,'goal parent cycle') END;
END;

DROP TRIGGER goal_link_owner;
CREATE TRIGGER goal_link_owner BEFORE INSERT ON goal_links BEGIN
 SELECT CASE WHEN NEW.link_type NOT IN ('FUTURE_VISION','CAREER_DIRECTION') OR NOT EXISTS(
   SELECT 1 FROM goal_versions gv JOIN goals g ON g.id=gv.goal_id
   JOIN future_vision_versions f ON f.id=NEW.reference_id
   WHERE gv.id=NEW.goal_version_id AND f.member_id=g.member_id AND f.unit_id=g.unit_id
   AND gv.status IN ('DRAFT','REVIEW','AWAITING_MEMBER_CONFIRMATION')
   AND ((NEW.link_type='FUTURE_VISION' AND f.kind='FUTURE_VISION') OR
        (NEW.link_type='CAREER_DIRECTION' AND f.kind='CAREER_DIRECTION'))
 ) THEN RAISE(ABORT,'goal link owner mismatch') END;
END;

CREATE TRIGGER evidence_current_revision BEFORE INSERT ON evidence BEGIN
 SELECT CASE WHEN NOT EXISTS(
   SELECT 1 FROM action_items a JOIN goals g ON g.current_version_id=a.goal_version_id
   WHERE a.id=NEW.action_id AND a.goal_version_id=NEW.goal_version_id AND a.member_id=NEW.member_id
 ) THEN RAISE(ABORT,'evidence owner or current revision mismatch') END;
END;
