FROM alpine:latest

RUN apk add --no-cache \
    unzip \
    ca-certificates

# Download from the new host
ADD https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1/pocketbase_0.41.1_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/

EXPOSE 8080

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080"]
