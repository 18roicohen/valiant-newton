async function testLiveApis() {
  console.log('--- Probing RunPod Public GraphQL ---');
  try {
    const runpodGql = `query GpuTypes {
      gpuTypes {
        id
        displayName
        memoryInGb
        securePrice
        communityPrice
        secureSpotPrice
        communitySpotPrice
      }
    }`;
    const res = await fetch('https://api.runpod.io/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dynep-Market-Indexer/1.0',
      },
      body: JSON.stringify({ query: runpodGql }),
    });
    console.log('RunPod status:', res.status);
    const data: any = await res.json();
    if (data.data?.gpuTypes) {
      console.log('RunPod returned GPU types count:', data.data.gpuTypes.length);
      console.log('Sample RunPod item:', data.data.gpuTypes[0]);
    } else {
      console.log('RunPod errors or response:', JSON.stringify(data));
    }
  } catch (err: any) {
    console.error('RunPod fetch error:', err.message);
  }

  console.log('\n--- Probing Vast.ai raw search with proper headers ---');
  try {
    const vastUrl = 'https://raw.vast.ai/api/v0/bundles/';
    const res = await fetch(vastUrl, {
      headers: { 'User-Agent': 'curl/8.0' },
    });
    console.log('Raw vast status:', res.status);
  } catch (err: any) {
    console.error('Raw vast error:', err.message);
  }

  console.log('\n--- Probing TensorDock Public API ---');
  try {
    // TensorDock list locations / instances endpoint
    const tdUrl = 'https://marketplace.tensordock.com/api/v0/client/deploy/hostnodes';
    const res = await fetch(tdUrl, {
      headers: { 'User-Agent': 'Dynep-Market-Indexer/1.0' },
    });
    console.log('TensorDock status:', res.status);
  } catch (err: any) {
    console.error('TensorDock error:', err.message);
  }

  console.log('\n--- Probing Shadeform Public API ---');
  try {
    const res = await fetch('https://api.shadeform.ai/v1/instances/types', {
      headers: { 'User-Agent': 'Dynep-Market-Indexer/1.0' },
    });
    console.log('Shadeform status:', res.status);
    if (res.ok) {
      const data: any = await res.json();
      console.log('Shadeform instances count:', data.instance_types?.length || data.length);
    }
  } catch (err: any) {
    console.error('Shadeform error:', err.message);
  }

  console.log('\n--- Probing cloud-gpus.com or other aggregators ---');
  try {
    const res = await fetch('https://cloud-gpus.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    console.log('cloud-gpus.com status:', res.status);
  } catch (err: any) {
    console.error('cloud-gpus.com error:', err.message);
  }
}

testLiveApis();
