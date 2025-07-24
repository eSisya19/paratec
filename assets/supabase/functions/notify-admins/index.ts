// /supabase/functions/notify-admins/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEB3FORMS_ACCESS_KEY = Deno.env.get('WEB3FORMS_ACCESS_KEY')!

// ===================================================================
// HELPER FUNCTION to get a display name for any record ID
// ===================================================================
async function getRecordName(supabaseAdmin: any, tableName: string, recordId: string): Promise<string> {
  if (!recordId) return "N/A";
  
  // Define common "name" columns to check, in order of preference
  const nameColumns = ['asset_name', 'full_name', 'title', 'subject', 'name'];
  
  try {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select(nameColumns.join(',')) // Try to select all common name columns
      .eq('id', recordId)
      .single();

    if (error) {
      // This is expected if a record doesn't exist, not a fatal error.
      console.log(`Info: Could not find record for ID ${recordId} in table ${tableName}.`);
      return `Record (ID: ${recordId.substring(0, 8)}...)`;
    }
    
    // Find the first available name column that has a value
    for (const col of nameColumns) {
      if (data && data[col]) {
        return data[col];
      }
    }
    
    // Fallback if no name columns are found
    return `Record (ID: ${recordId.substring(0, 8)}...)`;

  } catch (e) {
    console.error(`Error in getRecordName for ID ${recordId} from table ${tableName}:`, e.message);
    return `Record (ID: ${recordId.substring(0, 8)}...)`;
  }
}

// ===================================================================
// DYNAMIC FORMATTER FUNCTION (with special case for 'trips')
// ===================================================================
async function dynamicFormatter(record: any, table: string, supabaseAdmin: any): Promise<string> {
  
  // --- SPECIAL CASE: Handle the 'trips' table with a custom, detailed format ---
  if (table === 'trips') {
    const creatorName = await getRecordName(supabaseAdmin, 'users', record.created_by);
    
    // Fetch participant names for the trip
    const { data: participants, error } = await supabaseAdmin
      .from('trip_participants')
      .select('user:users(full_name)')
      .eq('trip_id', record.id);
    
    const participantNames = participants ? participants.map(p => p.user.full_name).join(', ') : 'N/A';
    
    return `
A trip to '${record.destination}' was updated.

----------------------------------------
DETAILS
----------------------------------------
Destination       : ${record.destination}
Scheduled Date    : ${new Date(record.scheduled_date).toLocaleDateString()}
Status              : ${record.status}
Created By          : ${creatorName}
Participants        : ${participantNames}

TIMELINE
----------------------------------------
Departure           : ${record.actual_departure ? new Date(record.actual_departure).toLocaleString() : 'Not started'}
Return              : ${record.actual_return ? new Date(record.actual_return).toLocaleString() : 'In progress'}

REPORTS
----------------------------------------
Reason for Trip     : ${record.reason || 'N/A'}
Conclusion Report   : ${record.conclusion_report || 'Not filed yet'}
    `;
  }

  // --- GENERIC FORMATTER: Fallback for all other tables ---
  let details = `A record in the '${table}' table was changed.\n\nDETAILS\n----------------------------------------\n`;
  
  const IGNORED_FIELDS = ['id', 'created_at', 'updated_at'];
  const keyToTableMap: Record<string, string> = {
    'created_by': 'users',
    'assigned_to': 'users',
    'processed_by': 'users',
    'user_id': 'users',
    'reviewer_id': 'users',
    'author_id': 'users',
    'asset_id': 'assets',
    'ticket_id': 'tickets',
    'bulletin_id': 'bulletins',
    'review_id': 'reviews'
  };

  for (const key in record) {
    if (IGNORED_FIELDS.includes(key)) continue;

    let value = record[key];
    const formattedKey = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    if (value === null || value === undefined) {
      value = "N/A";
    } 
    else if (keyToTableMap[key]) {
      const lookupTableName = keyToTableMap[key];
      value = await getRecordName(supabaseAdmin, lookupTableName, value);
    }
    else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        value = new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      } catch (e) { /* use original string if formatting fails */ }
    }

    details += `${formattedKey.padEnd(20, ' ')}: ${value}\n`;
  }
  return details;
}

// ===================================================================
// MAIN EDGE FUNCTION LOGIC
// ===================================================================
Deno.serve(async (req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const payload = await req.json();
    const { record, type, table, actor_id } = payload;
    
    if (actor_id) {
      const { data: actor } = await supabaseAdmin.from('users').select('role').eq('id', actor_id).single();
      if (actor && actor.role === 'Admin') {
        console.log(`Change made by an Admin (${actor_id}). Suppressing notification.`);
        return new Response(JSON.stringify({ message: 'Notification suppressed for admin action.' }), { status: 200 });
      }
    }
    
    const subject = `[${table.toUpperCase()}] Record ${type}D`;
    
    // This single call handles all tables, using the special 'trips' logic when needed.
    const plainTextMessage = await dynamicFormatter(record, table, supabaseAdmin);
    
    const emailData = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: subject,
      from_name: "Company App Notifier",
      message: `New Activity in Company App\n========================================\n${plainTextMessage}\n\n----------------------------------------\nThis is an automated notification.`,
    };

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(emailData),
    });
    
    const jsonResponse = await response.json();
    if (!jsonResponse.success) throw new Error(jsonResponse.message);
    
    return new Response(JSON.stringify({ message: 'Smart dynamic notification sent' }), { status: 200 });
  } catch (error) {
    console.error("Error in notify-admins function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});