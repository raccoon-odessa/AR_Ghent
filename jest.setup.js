jest.mock('three', () => {
    const originalThree = jest.requireActual('three');
    return {
      ...originalThree,
      WebGLRenderer: jest.fn(() => ({
        setSize: jest.fn(),
        setPixelRatio: jest.fn(),
        render: jest.fn(),
        domElement: document.createElement('canvas'),
        xr: {
          enabled: false,
          getController: jest.fn(() => ({
            addEventListener: jest.fn()
          }))
        }
      })),
      GLTFLoader: jest.fn(() => ({
        setPath: jest.fn().mockReturnThis(),
        load: jest.fn((url, onLoad) => {
          onLoad({ scene: {} });
        })
      }))
    };
  });
  