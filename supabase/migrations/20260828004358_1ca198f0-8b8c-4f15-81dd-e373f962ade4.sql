GRANT DELETE ON public.script_test_sessions TO authenticated;

CREATE POLICY "Users can delete their own expired test sessions"
ON public.script_test_sessions
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND expires_at < now());