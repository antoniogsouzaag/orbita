WITH outcome AS (
  SELECT CASE WHEN $3::text = 'accepted' AND nullif(btrim($5::text), '') IS NOT NULL THEN 'accepted'
              WHEN $3::text = 'canceled' AND $4::text = 'recipient_unavailable' THEN 'canceled'
              ELSE 'unknown' END AS state
), recorded AS (
  UPDATE barberias_whatsapp.reminder_queue q SET
    state = outcome.state,
    provider_message_id = CASE WHEN outcome.state = 'accepted' THEN $5::text ELSE NULL END,
    accepted_at = CASE WHEN outcome.state = 'accepted' THEN now() ELSE NULL END,
    detail = CASE WHEN outcome.state = 'accepted' THEN 'Accepted by provider; delivery not confirmed'
                  WHEN outcome.state = 'canceled' THEN 'Recipient explicitly unavailable on WhatsApp; no retry or operational alert'
                  ELSE 'Technical failure or uncertain send; no automatic retry' END,
    updated_at = now()
  FROM outcome
  WHERE q.id = $1::bigint AND q.claimed_by = $2 AND q.state = 'processing'
  RETURNING q.id, q.state
), unlocked AS (
  UPDATE barberias_whatsapp.sender_lock SET
    locked_until = now(), next_send_at = now() + interval '3 seconds', owner = NULL
  WHERE singleton AND owner = $2 AND EXISTS (SELECT 1 FROM recorded)
  RETURNING singleton
)
SELECT (SELECT id::text FROM recorded) AS queue_id,
       $2::text AS execution_id,
       EXISTS (SELECT 1 FROM recorded) AS recorded,
       coalesce((SELECT state = 'unknown' FROM recorded), true) AS requires_alert;
