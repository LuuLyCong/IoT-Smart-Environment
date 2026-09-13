#include "dht22.h"
#include <stdio.h>
#include <stdlib.h>

void dht22_init(gpio_num_t pin) {
    // STUDENT TODO: Initialize the GPIO pin for DHT22 communication
    printf("DHT22 init on pin %d\n", pin);
}

int dht22_read(float *temperature, float *humidity) {
    // STUDENT TODO: Implement one-wire protocol to read from DHT22
    // For now, return mock data
    *temperature = 26.5 + (rand() % 10) / 10.0;
    *humidity = 60.0 + (rand() % 20) / 10.0;
    return 0; // Success
}
