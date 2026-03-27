const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kglwjwgdawyufmmlfjos.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxNjc1MywiZXhwIjoyMDg0NTkyNzUzfQ.1XWT3MO5eoP_pVAvlQrrTWuoCfnQabGw7xdStKvTWEw');

(async () => {
    const { data, error } = await supabase
        .from('tracked_emails')
        .select('subject, received_at, from_email, responsible_employee_email')
        .ilike('responsible_employee_email', '%jmining%')
        .gte('received_at', '2026-03-26T00:00:00Z')
        .order('received_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
})();
