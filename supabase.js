const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dckmoxtqsklegeetcgyl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja21veHRxc2tsZWdlZXRjZ3lsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODI1Njg3NiwiZXhwIjoyMDkzODMyODc2fQ.DSzBXkbaMy-QKVhdo8VwjZv2BvlBhq59OMSEqmkPteQ';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
