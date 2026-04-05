-- 테스트용 데이터 강제 삽입
INSERT INTO api_tokens (service_name, access_token, expired_at, updated_at)
VALUES ('TEST_SERVICE', 'test_token_123', now() + interval '1 day', now())
ON CONFLICT (service_name) DO UPDATE 
SET access_token = EXCLUDED.access_token;