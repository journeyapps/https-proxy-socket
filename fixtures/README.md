### SnakeOil Certificates
If the year is 2045 or for some or other reason you need to generate new snakeoil certificates do the following.   
---
Please install:  
- [CloudFlare cfssl](https://github.com/cloudflare/cfssl)     

#### Root CA Certificate Files
```bash
 cfssl gencert -initca ca-csr.json | cfssljson -bare ca
```
#### Certificate Files
```bash
 cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -hostname="127.0.0.1" \
  -profile=default \
  ca-csr.json | cfssljson -bare ssl-cert-snakeoil
```