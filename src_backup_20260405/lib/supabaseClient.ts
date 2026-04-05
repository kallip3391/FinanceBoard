import { createClient } from '@supabase/supabase-js'

// 1. .env.local 파일에 정의한 환경 변수를 가져옵니다.
// 변수명 뒤의 '!'는 이 값이 반드시 존재한다는 것을 TypeScript에게 명시하는 기호입니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 2. Supabase 클라이언트를 초기화하여 내보냅니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)