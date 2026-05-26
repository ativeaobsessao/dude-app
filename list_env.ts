console.log('Environment variables:');
for (const key of Object.keys(process.env)) {
  if (key.includes('SUPABASE') || key.includes('DATABASE') || key.includes('POSTGRES') || key.includes('PG')) {
    console.log(`${key}=${process.env[key] ? '***' : 'empty'}`);
  }
}
