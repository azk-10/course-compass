DROP POLICY "anyone can see courses with a live session" ON public.courses;

CREATE POLICY "anyone can see active courses"
ON public.courses FOR SELECT
TO anon, authenticated
USING (status = 'active');