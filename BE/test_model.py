from dotenv import load_dotenv
load_dotenv()
print('1. loading model...')
import torch
import json
from pathlib import Path

meta = json.loads(Path('saved_models/default/mnist_meta.json').read_text())
print('meta:', meta)

import torch.nn as nn
class MNISTNet(nn.Module):
    def __init__(self, hidden_sizes):
        super().__init__()
        layers = []
        in_size = 784
        for h in hidden_sizes:
            layers += [nn.Linear(in_size, h), nn.ReLU()]
            in_size = h
        layers.append(nn.Linear(in_size, 10))
        self.net = nn.Sequential(*layers)
    def forward(self, x):
        return self.net(x.view(-1, 784))

model = MNISTNet(meta['hidden_sizes'])
model.load_state_dict(torch.load('saved_models/default/mnist_net.pt', map_location='cpu', weights_only=True))
print('2. model OK')
