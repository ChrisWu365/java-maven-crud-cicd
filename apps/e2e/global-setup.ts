async function waitForServer(url: string, name: string, maxRetries = 30, retryDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`${name} is ready at ${url}`);
        return;
      }
    } catch (error) {
      console.log(`Waiting for ${name} at ${url}... (${i + 1}/${maxRetries})`);
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  throw new Error(`${name} not ready at ${url} after ${maxRetries} attempts`);
}

async function globalSetup() {
  await Promise.all([
    waitForServer('http://localhost:5173', 'Web server'),
    waitForServer('http://localhost:4000/health', 'API server'),
  ]);
  console.log('All servers are ready');
}

export default globalSetup;
